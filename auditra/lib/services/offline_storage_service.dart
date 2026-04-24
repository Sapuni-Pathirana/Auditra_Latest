import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import 'offline_db_service.dart';
import '../models/project_model.dart';

const _uuid = Uuid();

/// Service for managing offline storage of data
class OfflineStorageService {
  /// Save valuation offline
  /// Returns localId (UUID) for the saved valuation
  static Future<String> saveValuationOffline(Map<String, dynamic> valuationData) async {
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      throw Exception('Offline mode not enabled for this user');
    }

    // Ensure database is initialized
    if (!OfflineDBService.isInitialized) {
      await OfflineDBService.initOfflineDB();
    }

    final box = OfflineDBService.valuationsBox;
    final localId = _uuid.v4();
    
    // Add offline metadata
    // SyncStatus: 0=Queued, 1=Synced, 2=Syncing, 3=Failed
    final offlineValuation = {
      ...valuationData,
      'localId': localId,
      'syncStatus': 0, // 0 = Queued
      'serverId': null,
      'createdAt': DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
      'syncedAt': null,
    };

    await box.put(localId, offlineValuation);
    print('💾 Valuation saved offline with localId: ${localId.substring(0, 8)}...');
    
    return localId;
  }

  /// Get all offline valuations
  static List<Map<String, dynamic>> getAllOfflineValuations() {
    if (!OfflineDBService.isInitialized) {
      return [];
    }
    try {
      final box = OfflineDBService.valuationsBox;
      return box.values.map((value) => Map<String, dynamic>.from(value as Map)).toList();
    } catch (e) {
      return [];
    }
  }

  /// Get unsynced valuations.
  ///
  /// Includes:
  ///   - Queued (`syncStatus == 0`)
  ///   - Failed (`syncStatus == 3`) whose `nextRetryAt` has elapsed
  ///     (exponential back-off, see [updateValuationSyncStatus]).
  static List<Map<String, dynamic>> getUnsyncedValuations() {
    if (!OfflineDBService.isInitialized) {
      return [];
    }
    try {
      final box = OfflineDBService.valuationsBox;
      final now = DateTime.now();
      return box.values
          .where((value) {
            final map = Map<String, dynamic>.from(value as Map);
            final s = map['syncStatus'];
            if (s == 0) return true;
            if (s == 3) {
              final ts = map['nextRetryAt'];
              if (ts == null) return true;
              try {
                return DateTime.parse(ts).isBefore(now) ||
                    DateTime.parse(ts).isAtSameMomentAs(now);
              } catch (_) {
                return true;
              }
            }
            return false;
          })
          .map((value) => Map<String, dynamic>.from(value as Map))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Mark valuation as synced
  static Future<void> markValuationSynced(String localId, int serverId) async {
    if (!OfflineDBService.isInitialized) {
      return;
    }
    final box = OfflineDBService.valuationsBox;
    final valuation = box.get(localId) as Map<String, dynamic>?;
    
    if (valuation != null) {
      // Delete the synced valuation immediately - it's already on the server
      // No need to keep it in local storage
      await box.delete(localId);
      print('✅ Valuation synced and removed from local storage: $localId -> serverId: $serverId');
    }
  }

  /// Update syncStatus for a queued valuation (0=Queued,1=Synced,2=Syncing,3=Failed).
  ///
  /// On Failed (3), bumps `retryCount` and computes an exponential-back-off
  /// `nextRetryAt` (capped at 1 hour).
  static Future<void> updateValuationSyncStatus(String localId, int status) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.valuationsBox;
    final valuation = box.get(localId);
    if (valuation != null) {
      final map = Map<String, dynamic>.from(valuation as Map);
      map['syncStatus'] = status;
      if (status == 3) {
        final int attempts = ((map['retryCount'] as int?) ?? 0) + 1;
        // 30s, 60s, 2min, 4min, 8min, 16min, 32min, 60min cap.
        final seconds =
            (30 * (1 << (attempts - 1).clamp(0, 7))).clamp(30, 3600);
        map['retryCount'] = attempts;
        map['nextRetryAt'] =
            DateTime.now().add(Duration(seconds: seconds)).toIso8601String();
      } else if (status == 1) {
        map.remove('retryCount');
        map.remove('nextRetryAt');
      }
      await box.put(localId, map);
    }
  }

  /// Update valuation with server data
  static Future<void> updateValuationFromServer(String localId, Map<String, dynamic> serverData) async {
    final box = OfflineDBService.valuationsBox;
    final valuation = box.get(localId) as Map<String, dynamic>?;
    
    if (valuation != null) {
      // Merge server data with local data, preserving localId
      final updatedValuation = {
        ...valuation,
        ...serverData,
        'localId': valuation['localId'],
        'syncStatus': 1,
        'serverId': serverData['id'],
        'syncedAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
      };
      await box.put(localId, updatedValuation);
    }
  }

  /// Delete valuation
  static Future<void> deleteValuation(String localId) async {
    if (!OfflineDBService.isInitialized) {
      return;
    }
    final box = OfflineDBService.valuationsBox;
    await box.delete(localId);
  }

  /// Clean up synced valuations (remove valuations that have been successfully synced)
  static Future<int> cleanupSyncedValuations() async {
    if (!OfflineDBService.isInitialized) {
      return 0;
    }
    
    try {
      final box = OfflineDBService.valuationsBox;
      final keysToDelete = <String>[];
      
      // Find all synced valuations
      for (var key in box.keys) {
        final value = box.get(key);
        if (value != null) {
          final map = Map<String, dynamic>.from(value as Map);
          // Remove valuations that have been synced (syncStatus == 1)
          if (map['syncStatus'] == 1) {
            keysToDelete.add(key.toString());
          }
        }
      }
      
      // Delete synced valuations
      for (var key in keysToDelete) {
        await box.delete(key);
      }
      
      print('🧹 Cleaned up ${keysToDelete.length} synced valuations');
      return keysToDelete.length;
    } catch (e) {
      print('Error cleaning up synced valuations: $e');
      return 0;
    }
  }

  /// Delete all unsynced valuations (use with caution - this removes all pending sync items)
  static Future<int> deleteAllUnsyncedValuations() async {
    if (!OfflineDBService.isInitialized) {
      return 0;
    }
    
    try {
      final box = OfflineDBService.valuationsBox;
      final keysToDelete = <String>[];
      
      // Find all unsynced valuations
      for (var key in box.keys) {
        final value = box.get(key);
        if (value != null) {
          final map = Map<String, dynamic>.from(value as Map);
          // Remove valuations that are unsynced (syncStatus == 0)
          if (map['syncStatus'] == 0) {
            keysToDelete.add(key.toString());
          }
        }
      }
      
      // Delete unsynced valuations
      for (var key in keysToDelete) {
        await box.delete(key);
      }
      
      print('🗑️ Deleted ${keysToDelete.length} unsynced valuations');
      return keysToDelete.length;
    } catch (e) {
      print('Error deleting unsynced valuations: $e');
      return 0;
    }
  }

  /// Get valuation by localId
  static Map<String, dynamic>? getValuationByLocalId(String localId) {
    final box = OfflineDBService.valuationsBox;
    final value = box.get(localId);
    return value != null ? Map<String, dynamic>.from(value as Map) : null;
  }

  /// Cache projects for offline access
  static Future<void> cacheProjects(List<Project> projects) async {
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      return;
    }

    // Ensure database is initialized
    if (!OfflineDBService.isInitialized) {
      await OfflineDBService.initOfflineDB();
    }

    final box = OfflineDBService.projectsCacheBox;
    
    // Convert projects to JSON and cache
    final projectsJson = projects.map((project) => project.toJson()).toList();
    
    await box.put('projects_list', projectsJson);
    await box.put('last_updated', DateTime.now().toIso8601String());
    
    print('💾 Cached ${projects.length} projects for offline access');
  }

  /// Get cached projects
  static List<Project>? getCachedProjects() {
    if (!OfflineDBService.isInitialized) {
      return null;
    }
    try {
      final box = OfflineDBService.projectsCacheBox;
      final projectsJson = box.get('projects_list') as List<dynamic>?;
      
      if (projectsJson == null) {
        return null;
      }
      
      return projectsJson
          .map((json) => Project.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e) {
      print('Error parsing cached projects: $e');
      return null;
    }
  }

  /// Get last cache update time
  static DateTime? getCacheLastUpdated() {
    final box = OfflineDBService.projectsCacheBox;
    final timestamp = box.get('last_updated') as String?;
    return timestamp != null ? DateTime.parse(timestamp) : null;
  }

  /// Clear project cache
  static Future<void> clearProjectCache() async {
    final box = OfflineDBService.projectsCacheBox;
    await box.clear();
  }

  /// Cache project visits for offline access by project id.
  static Future<void> cacheProjectVisits(
    int projectId,
    List<Map<String, dynamic>> visits,
  ) async {
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      return;
    }
    if (!OfflineDBService.isInitialized) {
      await OfflineDBService.initOfflineDB();
    }
    final box = OfflineDBService.projectsCacheBox;
    await box.put('project_visits_$projectId', visits);
    await box.put(
      'project_visits_last_updated_$projectId',
      DateTime.now().toIso8601String(),
    );
  }

  /// Get cached project visits by project id.
  static List<Map<String, dynamic>>? getCachedProjectVisits(int projectId) {
    if (!OfflineDBService.isInitialized) return null;
    try {
      final box = OfflineDBService.projectsCacheBox;
      final raw = box.get('project_visits_$projectId') as List<dynamic>?;
      if (raw == null) return null;
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return null;
    }
  }

  /// Save attendance offline
  static Future<String> saveAttendanceOffline(Map<String, dynamic> attendanceData) async {
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      throw Exception('Offline mode not enabled for this user');
    }

    final box = OfflineDBService.attendanceBox;
    final localId = _uuid.v4();
    
    final offlineAttendance = {
      ...attendanceData,
      'localId': localId,
      'syncStatus': 0,
      'serverId': null,
      'createdAt': DateTime.now().toIso8601String(),
      'syncedAt': null,
    };

    await box.put(localId, offlineAttendance);
    print('💾 Attendance saved offline: $localId');
    
    return localId;
  }

  /// Get offline attendance records
  static List<Map<String, dynamic>> getOfflineAttendance() {
    final box = OfflineDBService.attendanceBox;
    return box.values.map((value) => Map<String, dynamic>.from(value as Map)).toList();
  }

  /// Get unsynced attendance records (queued or retry-eligible failures).
  static List<Map<String, dynamic>> getUnsyncedAttendance() {
    if (!OfflineDBService.isInitialized) {
      return [];
    }
    try {
      final box = OfflineDBService.attendanceBox;
      final now = DateTime.now();
      return box.values
          .where((value) {
            final map = Map<String, dynamic>.from(value as Map);
            final s = map['syncStatus'];
            if (s == 0) return true;
            if (s == 3) {
              final ts = map['nextRetryAt'];
              if (ts == null) return true;
              try {
                return DateTime.parse(ts).isBefore(now) ||
                    DateTime.parse(ts).isAtSameMomentAs(now);
              } catch (_) {
                return true;
              }
            }
            return false;
          })
          .map((value) => Map<String, dynamic>.from(value as Map))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Mark an attendance record as Failed with exponential back-off (see
  /// [updateValuationSyncStatus] for the same algorithm).
  static Future<void> markAttendanceFailed(String localId) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.attendanceBox;
    final record = box.get(localId);
    if (record == null) return;
    final map = Map<String, dynamic>.from(record as Map);
    map['syncStatus'] = 3;
    final int attempts = ((map['retryCount'] as int?) ?? 0) + 1;
    final seconds = (30 * (1 << (attempts - 1).clamp(0, 7))).clamp(30, 3600);
    map['retryCount'] = attempts;
    map['nextRetryAt'] =
        DateTime.now().add(Duration(seconds: seconds)).toIso8601String();
    await box.put(localId, map);
  }

  /// Mark attendance as synced
  static Future<void> markAttendanceSynced(String localId, int serverId) async {
    final box = OfflineDBService.attendanceBox;
    final attendance = box.get(localId) as Map<String, dynamic>?;
    
    if (attendance != null) {
      attendance['syncStatus'] = 1;
      attendance['serverId'] = serverId;
      attendance['syncedAt'] = DateTime.now().toIso8601String();
      await box.put(localId, attendance);
    }
  }

  /// Save photo offline to filesystem
  /// Returns the file path where photo is stored
  static Future<String> savePhotoOffline(File photoFile, String valuationLocalId) async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final photosDir = Directory('${appDir.path}/photos/$valuationLocalId');
      
      if (!await photosDir.exists()) {
        await photosDir.create(recursive: true);
      }

      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final fileName = 'photo_$timestamp.jpg';
      final savedFile = File('${photosDir.path}/$fileName');
      
      await photoFile.copy(savedFile.path);
      
      // Store photo metadata in cache
      final box = OfflineDBService.photosCacheBox;
      final photoId = _uuid.v4();
      await box.put(photoId, {
        'id': photoId,
        'valuationLocalId': valuationLocalId,
        'filePath': savedFile.path,
        'fileName': fileName,
        'createdAt': DateTime.now().toIso8601String(),
        'syncStatus': 0,
        'serverId': null,
      });
      
      print('💾 Photo saved offline: ${savedFile.path}');
      return savedFile.path;
    } catch (e) {
      print('Error saving photo offline: $e');
      rethrow;
    }
  }

  /// Get photo file path by photo ID
  static String? getPhotoPath(String photoId) {
    final box = OfflineDBService.photosCacheBox;
    final photoData = box.get(photoId) as Map<String, dynamic>?;
    return photoData?['filePath'] as String?;
  }

  /// Get all photos for a valuation
  static List<Map<String, dynamic>> getPhotosForValuation(String valuationLocalId) {
    final box = OfflineDBService.photosCacheBox;
    return box.values
        .where((value) {
          final map = Map<String, dynamic>.from(value as Map);
          return map['valuationLocalId'] == valuationLocalId;
        })
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
  }

  /// Get unsynced photos (queued or retry-eligible failures).
  static List<Map<String, dynamic>> getUnsyncedPhotos() {
    if (!OfflineDBService.isInitialized) {
      return [];
    }
    try {
      final box = OfflineDBService.photosCacheBox;
      final now = DateTime.now();
      return box.values
          .where((value) {
            final map = Map<String, dynamic>.from(value as Map);
            final s = map['syncStatus'];
            if (s == 0) return true;
            if (s == 3) {
              final ts = map['nextRetryAt'];
              if (ts == null) return true;
              try {
                return DateTime.parse(ts).isBefore(now) ||
                    DateTime.parse(ts).isAtSameMomentAs(now);
              } catch (_) {
                return true;
              }
            }
            return false;
          })
          .map((value) => Map<String, dynamic>.from(value as Map))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Mark photo as synced
  static Future<void> markPhotoSynced(String photoId, int serverId) async {
    final box = OfflineDBService.photosCacheBox;
    final photo = box.get(photoId) as Map<String, dynamic>?;

    if (photo != null) {
      photo['syncStatus'] = 1;
      photo['serverId'] = serverId;
      photo['syncedAt'] = DateTime.now().toIso8601String();
      photo.remove('retryCount');
      photo.remove('nextRetryAt');
      await box.put(photoId, photo);
    }
  }

  /// Mark a photo record as Failed with exponential back-off.
  static Future<void> markPhotoFailed(String photoId) async {
    final box = OfflineDBService.photosCacheBox;
    final photo = box.get(photoId) as Map<String, dynamic>?;
    if (photo == null) return;
    photo['syncStatus'] = 3;
    final int attempts = ((photo['retryCount'] as int?) ?? 0) + 1;
    final seconds = (30 * (1 << (attempts - 1).clamp(0, 7))).clamp(30, 3600);
    photo['retryCount'] = attempts;
    photo['nextRetryAt'] =
        DateTime.now().add(Duration(seconds: seconds)).toIso8601String();
    await box.put(photoId, photo);
  }

  /// Queue a valuation submit action for automatic retry when online.
  static Future<String> queueValuationSubmissionOffline({
    required int valuationId,
    int? projectId,
    String? projectTitle,
  }) async {
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      throw Exception('Offline mode not enabled for this user');
    }

    if (!OfflineDBService.isInitialized) {
      await OfflineDBService.initOfflineDB();
    }

    final box = OfflineDBService.syncQueueBox;
    final localId = _uuid.v4();
    await box.put(localId, {
      'id': localId,
      'type': 'valuation_submit',
      'valuationId': valuationId,
      if (projectId != null) 'projectId': projectId,
      if (projectTitle != null && projectTitle.isNotEmpty) 'projectTitle': projectTitle,
      'syncStatus': 0, // 0=Queued, 1=Synced, 2=Syncing, 3=Failed
      'createdAt': DateTime.now().toIso8601String(),
      'syncedAt': null,
      'retryCount': 0,
      'nextRetryAt': null,
    });
    return localId;
  }

  /// Get queued valuation submit actions (queued/retry-eligible failed).
  static List<Map<String, dynamic>> getUnsyncedSubmitActions() {
    if (!OfflineDBService.isInitialized) {
      return [];
    }
    try {
      final box = OfflineDBService.syncQueueBox;
      final now = DateTime.now();
      return box.values
          .where((value) {
            final map = Map<String, dynamic>.from(value as Map);
            if (map['type'] != 'valuation_submit') return false;
            final s = map['syncStatus'];
            if (s == 0) return true;
            if (s == 3) {
              final ts = map['nextRetryAt'];
              if (ts == null) return true;
              try {
                final dt = DateTime.parse(ts.toString());
                return dt.isBefore(now) || dt.isAtSameMomentAs(now);
              } catch (_) {
                return true;
              }
            }
            return false;
          })
          .map((value) => Map<String, dynamic>.from(value as Map))
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> markSubmitActionSyncing(String id) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.syncQueueBox;
    final item = box.get(id);
    if (item == null) return;
    final map = Map<String, dynamic>.from(item as Map);
    map['syncStatus'] = 2;
    await box.put(id, map);
  }

  static Future<void> markSubmitActionSynced(String id) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.syncQueueBox;
    await box.delete(id);
  }

  static Future<void> markSubmitActionFailed(String id) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.syncQueueBox;
    final item = box.get(id);
    if (item == null) return;
    final map = Map<String, dynamic>.from(item as Map);
    map['syncStatus'] = 3;
    final int attempts = ((map['retryCount'] as int?) ?? 0) + 1;
    final seconds = (30 * (1 << (attempts - 1).clamp(0, 7))).clamp(30, 3600);
    map['retryCount'] = attempts;
    map['nextRetryAt'] =
        DateTime.now().add(Duration(seconds: seconds)).toIso8601String();
    await box.put(id, map);
  }

  /// Get statistics
  static Map<String, int> getStats() {
    if (!OfflineDBService.isInitialized) {
      return {
        'unsynced_valuations': 0,
        'total_valuations': 0,
        'unsynced_attendance': 0,
        'total_attendance': 0,
        'unsynced_photos': 0,
        'total_photos': 0,
        'unsynced_submit_actions': 0,
        'total_submit_actions': 0,
      };
    }
    try {
      return {
        'unsynced_valuations': getUnsyncedValuations().length,
        'total_valuations': OfflineDBService.valuationsBox.length,
        'unsynced_attendance': getUnsyncedAttendance().length,
        'total_attendance': OfflineDBService.attendanceBox.length,
        'unsynced_photos': getUnsyncedPhotos().length,
        'total_photos': OfflineDBService.photosCacheBox.length,
        'unsynced_submit_actions': getUnsyncedSubmitActions().length,
        'total_submit_actions': OfflineDBService.syncQueueBox.length,
      };
    } catch (e) {
      return {
        'unsynced_valuations': 0,
        'total_valuations': 0,
        'unsynced_attendance': 0,
        'total_attendance': 0,
        'unsynced_photos': 0,
        'total_photos': 0,
        'unsynced_submit_actions': 0,
        'total_submit_actions': 0,
      };
    }
  }
}

