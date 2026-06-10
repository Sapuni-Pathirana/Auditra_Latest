import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import 'offline_db_service.dart';
import '../models/project_model.dart';

const _uuid = Uuid();

/// Handles reading and writing every type of offline data for field officers.
///
/// This is the main entry point for saving data locally when there is no
/// internet connection. It wraps [OfflineDBService] (the raw Hive boxes) with
/// higher-level methods that:
///   - Assign a unique local ID (UUID) to each new offline record.
///   - Stamp every record with a `syncStatus` code:
///       0 = Queued (waiting to be uploaded)
///       1 = Synced  (already uploaded to the server)
///       2 = Syncing (upload is in progress right now)
///       3 = Failed  (upload failed; will retry after a back-off delay)
///   - Apply exponential back-off on failures (first retry after 30 s,
///     then 60 s, 2 min, 4 min … up to a maximum of 1 hour).
///
/// Types of data managed:
///   - Valuations   → `saveValuationOffline`, `getUnsyncedValuations`, etc.
///   - Projects     → `cacheProjects`, `getCachedProjects`, etc.
///   - Attendance   → `saveAttendanceOffline`, `getUnsyncedAttendance`, etc.
///   - Photos       → `savePhotoOffline`, `getUnsyncedPhotos`, etc.
///   - Submit queue → `queueValuationSubmissionOffline`, `getUnsyncedSubmitActions`, etc.
class OfflineStorageService {
  /// Saves a valuation report to the local Hive database when offline.
  ///
  /// Generates a UUID as the `localId` (a temporary ID that lives only on
  /// this device until the record is uploaded to the server and gets a real
  /// server-side integer ID).
  ///
  /// The record is saved with `syncStatus = 0` (Queued) so [SyncEngine]
  /// will automatically pick it up and upload it when internet returns.
  ///
  /// Returns the `localId` so the caller can reference this record later.
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

  /// Returns every valuation currently in the local Hive box, regardless of
  /// sync status. Returns an empty list if the database is not initialised.
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

  /// Returns valuations that still need to be uploaded to the server.
  ///
  /// A valuation is included if:
  ///   - `syncStatus == 0` (Queued — never tried yet), OR
  ///   - `syncStatus == 3` (Failed) AND the `nextRetryAt` timestamp has passed
  ///     (exponential back-off delay is over, so it is ready to retry).
  ///
  /// Valuations with status 1 (Synced) or 2 (currently Syncing) are excluded.
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

  /// Called after a valuation has been successfully uploaded to the server.
  ///
  /// Deletes the local copy entirely — once the server has the record there
  /// is no need to keep it on the device too. The `serverId` passed in is
  /// the integer primary-key assigned by the server.
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

  /// Updates the `syncStatus` field of a queued valuation.
  ///
  /// Status codes: 0 = Queued, 1 = Synced, 2 = Syncing, 3 = Failed.
  ///
  /// When status is set to 3 (Failed), this method also computes an
  /// exponential back-off delay before the next retry:
  ///   attempt 1 → 30 s, attempt 2 → 60 s, attempt 3 → 2 min … max 1 hour.
  /// The `nextRetryAt` timestamp is stored so [getUnsyncedValuations] knows
  /// when to include the record again.
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

  /// Merges fresh data from the server into an existing local valuation record.
  ///
  /// Local-only fields (`localId`) are preserved. The `serverId` and
  /// `syncStatus` are updated to reflect the server's response.
  /// Use this when the server returns updated data after a successful upload.
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

  /// Permanently removes a valuation record from the local database by its `localId`.
  static Future<void> deleteValuation(String localId) async {
    if (!OfflineDBService.isInitialized) {
      return;
    }
    final box = OfflineDBService.valuationsBox;
    await box.delete(localId);
  }

  /// Scans the valuations box and deletes every record that has already been
  /// successfully synced (`syncStatus == 1`). This keeps the local database
  /// small — once the server has the data, there is no reason to store it locally.
  /// Returns the number of records that were deleted.
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

  /// Deletes every queued (not-yet-synced) valuation from the local database.
  /// WARNING: this permanently discards all pending offline data that has not
  /// yet reached the server. Only call this at explicit user request.
  /// Returns the number of records deleted.
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

  /// Looks up a single valuation in the local database by its device-assigned UUID.
  /// Returns null if no record with that `localId` exists.
  static Map<String, dynamic>? getValuationByLocalId(String localId) {
    final box = OfflineDBService.valuationsBox;
    final value = box.get(localId);
    return value != null ? Map<String, dynamic>.from(value as Map) : null;
  }

  /// Saves the full project list to the local database so the field officer
  /// can still see their projects when there is no internet.
  ///
  /// Each [Project] object is converted to a JSON map before storage.
  /// Also saves a `last_updated` timestamp so the app can show when the
  /// cache was last refreshed.
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

  /// Reads the cached project list from local storage and converts each JSON
  /// map back into a [Project] object. Returns null if nothing has been cached
  /// yet (i.e. the field officer has never been online since install).
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

  /// Returns the date and time when the project list was last downloaded
  /// from the server. Returns null if the cache has never been filled.
  static DateTime? getCacheLastUpdated() {
    final box = OfflineDBService.projectsCacheBox;
    final timestamp = box.get('last_updated') as String?;
    return timestamp != null ? DateTime.parse(timestamp) : null;
  }

  /// Removes all cached project data from local storage (project list and timestamps).
  static Future<void> clearProjectCache() async {
    final box = OfflineDBService.projectsCacheBox;
    await box.clear();
  }

  /// Saves the visit / check-in history for a specific project to local storage.
  /// Keyed by `project_visits_<projectId>` so each project has its own entry.
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

  /// Reads the cached visit list for the given project from local storage.
  /// Returns null if no visits have been cached for that project yet.
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

  /// Saves an attendance action (check-in, check-out, overtime start/end) to
  /// local storage with `syncStatus = 0` (Queued) so [SyncEngine] will upload
  /// it when the device is back online.
  ///
  /// Returns the UUID assigned to this local record.
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

  /// Returns all attendance records currently in local storage (all sync statuses).
  static List<Map<String, dynamic>> getOfflineAttendance() {
    final box = OfflineDBService.attendanceBox;
    return box.values.map((value) => Map<String, dynamic>.from(value as Map)).toList();
  }

  /// Returns attendance records that still need to be uploaded to the server.
  /// Same filter logic as [getUnsyncedValuations]: status 0 (Queued), or
  /// status 3 (Failed) whose back-off delay has expired.
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

  /// Marks an attendance record as Failed (status 3) and computes the next
  /// retry time using exponential back-off (same algorithm as
  /// [updateValuationSyncStatus]: 30 s, 60 s, 2 min … capped at 1 hour).
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

  /// Marks an attendance record as successfully synced (status 1) and
  /// stores the server-assigned ID so we have a reference to the server record.
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

  /// Copies a photo file into the app's private documents folder and records
  /// its path and metadata in the photos cache box with `syncStatus = 0`.
  ///
  /// Photos are organised in sub-folders by valuation:
  ///   `<appDocumentsDir>/photos/<valuationLocalId>/photo_<timestamp>.jpg`
  ///
  /// Returns the full path where the photo was saved on disk.
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

  /// Looks up a photo record by its UUID and returns the local file path.
  /// Returns null if the photo ID is not found in the cache.
  static String? getPhotoPath(String photoId) {
    final box = OfflineDBService.photosCacheBox;
    final photoData = box.get(photoId) as Map<String, dynamic>?;
    return photoData?['filePath'] as String?;
  }

  /// Returns all photos that belong to a specific offline valuation,
  /// identified by its `valuationLocalId` UUID.
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

  /// Returns photos that still need to be uploaded (status 0 or retry-ready status 3).
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

  /// Marks a photo record as successfully uploaded (status 1) and stores the
  /// server-assigned ID. Clears `retryCount` and `nextRetryAt`.
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

  /// Marks a photo upload as Failed (status 3) and sets the next retry time
  /// using exponential back-off (same algorithm as [updateValuationSyncStatus]).
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

  /// Queues a "submit this valuation to the accessor" action for later execution.
  ///
  /// The field officer may tap "Submit to Accessor" while offline. Instead of
  /// failing, this method saves the intent locally. When the device goes online,
  /// [SyncEngine] reads this queue and calls `ApiService.submitValuation` for each
  /// entry, which generates the PDF and changes the valuation status to "submitted".
  ///
  /// Returns the UUID of the new queue entry.
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

  /// Returns submission queue entries that are ready to be sent to the server
  /// (status 0, or status 3 whose back-off delay has expired).
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

  /// Marks a submit-action queue entry as "in progress" (status 2) so that
  /// [SyncEngine] does not attempt to run it twice at the same time.
  static Future<void> markSubmitActionSyncing(String id) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.syncQueueBox;
    final item = box.get(id);
    if (item == null) return;
    final map = Map<String, dynamic>.from(item as Map);
    map['syncStatus'] = 2;
    await box.put(id, map);
  }

  /// Deletes a submit-action queue entry after it has been successfully
  /// processed by the server. No further retries are needed.
  static Future<void> markSubmitActionSynced(String id) async {
    if (!OfflineDBService.isInitialized) return;
    final box = OfflineDBService.syncQueueBox;
    await box.delete(id);
  }

  /// Marks a submit-action as Failed (status 3) and applies exponential
  /// back-off so the engine does not hammer the server on repeated failures.
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

  /// Returns a count summary of unsynced and total records across all five
  /// data types. Example:
  /// ```
  /// {
  ///   'unsynced_valuations': 2,  'total_valuations': 5,
  ///   'unsynced_attendance': 1,  'total_attendance': 3,
  ///   'unsynced_photos': 4,      'total_photos': 10,
  ///   'unsynced_submit_actions': 1, 'total_submit_actions': 2,
  /// }
  /// ```
  /// Returns all zeros if the database is not initialised yet.
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

