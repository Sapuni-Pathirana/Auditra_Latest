import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'network_service.dart';
import 'offline_storage_service.dart';
import 'offline_db_service.dart';

/// Service for automatically syncing offline data when connectivity returns
class SyncEngine {
  static bool _isInitialized = false;
  static bool _isSyncing = false;
  static StreamSubscription<bool>? _networkSubscription;
  static Timer? _periodicSyncTimer;
  static final List<Function(Map<String, dynamic>)> _listeners = [];
  static bool _wasOffline = false;

  /// Initialize sync engine
  static Future<void> init() async {
    if (_isInitialized) {
      print('🔄 Sync engine already initialized');
      return;
    }

    // Check if offline mode is enabled
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      print('🔄 Sync engine not needed (offline mode disabled)');
      return;
    }

    // Initialize network service
    await NetworkService.init();

    // Track previous network state to detect transitions from offline to online
    _wasOffline = !NetworkService.isOnline;
    
    // Listen to network status changes
    _networkSubscription = NetworkService.networkStatusStream.listen((isOnline) {
      if (isOnline) {
        if (_wasOffline) {
          // Transitioning from offline to online - sync immediately
          print('📶 Network restored (was offline) - triggering sync');
          Future.delayed(const Duration(seconds: 1), () {
            syncAll();
          });
        }
        // Don't sync if already online - items should go directly to server
        _wasOffline = false;
      } else {
        print('📴 Network lost');
        _wasOffline = true;
      }
    });

    // Initial sync check: only if we were offline and now online, or if there are unsynced items
    if (NetworkService.isOnline) {
      // Check if there are unsynced items that need syncing
      final unsyncedValuations = OfflineStorageService.getUnsyncedValuations();
      if (unsyncedValuations.isNotEmpty) {
        print('📶 Online with ${unsyncedValuations.length} unsynced items - syncing now');
        Future.delayed(const Duration(seconds: 2), () {
          syncAll(silent: true);
        });
      }
    }

    // Feature #4/14 (C2): periodic background sync every 5 minutes. Each
    // `syncAll` call is cheap when there's nothing to sync.
    _periodicSyncTimer?.cancel();
    _periodicSyncTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (NetworkService.isOnline) {
        syncAll(silent: true);
      }
    });

    _isInitialized = true;
    print('✅ Sync engine initialized');
  }

  /// Add listener for sync events
  static void addListener(Function(Map<String, dynamic>) listener) {
    _listeners.add(listener);
  }

  /// Remove listener
  static void removeListener(Function(Map<String, dynamic>) listener) {
    _listeners.remove(listener);
  }

  /// Notify all listeners
  static void _notifyListeners(String event, Map<String, dynamic> data) {
    for (var listener in _listeners) {
      try {
        listener({'event': event, ...data});
      } catch (e) {
        print('Error in sync listener: $e');
      }
    }
  }

  /// Human-readable sync status label from int code
  static String syncStatusLabel(int code) {
    switch (code) {
      case 0: return 'Queued';
      case 1: return 'Synced';
      case 2: return 'Syncing';
      case 3: return 'Failed';
      default: return 'Unknown';
    }
  }

  /// Sync all pending items
  static Future<void> syncAll({bool silent = false}) async {
    if (_isSyncing) {
      if (!silent) print('⏳ Sync already in progress');
      return;
    }

    if (!NetworkService.isOnline) {
      if (!silent) print('📴 Offline - skipping sync');
      return;
    }

    // Check if there are any unsynced items before starting sync
    final unsyncedValuations = OfflineStorageService.getUnsyncedValuations();
    final unsyncedAttendance = OfflineStorageService.getUnsyncedAttendance();
    final unsyncedPhotos = OfflineStorageService.getUnsyncedPhotos();
    final unsyncedSubmissions = OfflineStorageService.getUnsyncedSubmitActions();
    final hasUnsyncedItems = unsyncedValuations.isNotEmpty ||
                            unsyncedAttendance.isNotEmpty ||
                            unsyncedPhotos.isNotEmpty ||
                            unsyncedSubmissions.isNotEmpty;

    if (!hasUnsyncedItems) {
      if (!silent) print('✅ No unsynced items - skipping sync');
      return;
    }

    _isSyncing = true;
    _notifyListeners('syncStart', {});

    try {
      int syncedCount = 0;
      int failedCount = 0;

      // Sync valuations
      final valuationResult = await _syncValuations(silent: silent);
      syncedCount += valuationResult['synced'] as int;
      failedCount += valuationResult['failed'] as int;

      // Sync attendance
      final attendanceResult = await _syncAttendance(silent: silent);
      syncedCount += attendanceResult['synced'] as int;
      failedCount += attendanceResult['failed'] as int;

      // Sync photos
      final photosResult = await _syncPhotos(silent: silent);
      syncedCount += photosResult['synced'] as int;
      failedCount += photosResult['failed'] as int;

      // Sync queued submit actions
      final submitResult = await _syncSubmitActions(silent: silent);
      syncedCount += submitResult['synced'] as int;
      failedCount += submitResult['failed'] as int;

      if (!silent || syncedCount > 0 || failedCount > 0) {
        print('✅ Sync complete: $syncedCount synced, $failedCount failed');
      }

      _notifyListeners('syncComplete', {
        'synced': syncedCount,
        'failed': failedCount,
      });
    } catch (e) {
      print('❌ Sync error: $e');
      _notifyListeners('syncError', {'error': e.toString()});
    } finally {
      _isSyncing = false;
    }
  }

  /// Silent sync for periodic checks
  static Future<void> syncAllSilent() {
    return syncAll(silent: true);
  }

  /// Sync a single valuation
  static Future<Map<String, dynamic>> syncValuation(String localId) async {
    final valuation = OfflineStorageService.getValuationByLocalId(localId);

    if (valuation == null) {
      return {'success': false, 'message': 'Valuation not found'};
    }

    if (valuation['syncStatus'] == 1) {
      return {'success': true, 'message': 'Already synced'};
    }

    // Mark as Syncing (2)
    await OfflineStorageService.updateValuationSyncStatus(localId, 2);
    _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Syncing'});

    try {
      final apiData = Map<String, dynamic>.from(valuation);
      apiData.remove('localId');
      apiData.remove('syncStatus');
      apiData.remove('serverId');
      apiData.remove('createdAt');
      apiData.remove('updatedAt');
      apiData.remove('syncedAt');
      apiData.remove('retryCount');
      apiData.remove('nextRetryAt');

      final result = await ApiService.syncValuationToServer(apiData);

      if (result['success'] == true) {
        final data = result['data'];
        if (data != null && data is Map<String, dynamic> && data['id'] != null) {
          final serverId = data['id'] as int;
          await OfflineStorageService.markValuationSynced(localId, serverId);
          _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Synced'});
          return {'success': true, 'serverId': serverId};
        } else {
          await OfflineStorageService.updateValuationSyncStatus(localId, 3); // Failed
          _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Failed'});
          return {'success': false, 'message': 'Server response missing valuation ID'};
        }
      } else {
        // Feature #4/14 (C2): basic conflict resolution on 409.
        final msg = (result['message'] ?? '').toString();
        if (msg.contains('409') || msg.toLowerCase().contains('conflict')) {
          final existingId = result['existing_id'];
          if (existingId is int) {
            await OfflineStorageService.markValuationSynced(localId, existingId);
            _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Synced'});
            _notifyListeners('conflictResolved', {
              'localId': localId,
              'serverId': existingId,
              'strategy': 'last-write-wins',
            });
            return {'success': true, 'serverId': existingId, 'conflict': true};
          }
        }
        await OfflineStorageService.updateValuationSyncStatus(localId, 3); // Failed
        _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Failed'});
        return {'success': false, 'message': msg.isEmpty ? 'Unknown error' : msg};
      }
    } catch (e) {
      await OfflineStorageService.updateValuationSyncStatus(localId, 3); // Failed
      _notifyListeners('itemStatusChanged', {'localId': localId, 'status': 'Failed'});
      return {'success': false, 'message': e.toString()};
    }
  }

  /// Sync all unsynced valuations
  static Future<Map<String, dynamic>> _syncValuations({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedValuations();
    
    if (!silent && unsynced.isNotEmpty) {
      print('📤 Syncing ${unsynced.length} valuations...');
    }

    int synced = 0;
    int failed = 0;

    for (var valuation in unsynced) {
      final localId = valuation['localId'] as String;
      final result = await syncValuation(localId);
      
      if (result['success']) {
        synced++;
        _notifyListeners('valuationSynced', {'localId': localId, 'serverId': result['serverId']});
      } else {
        failed++;
      }
    }

    // Clean up successfully synced valuations after sync
    if (synced > 0) {
      await OfflineStorageService.cleanupSyncedValuations();
    }

    if (!silent && synced > 0) {
      _notifyListeners('syncSuccess', {
        'message': '$synced valuation${synced > 1 ? 's' : ''} successfully synced and submitted',
        'synced': synced,
        'failed': failed,
      });
    }

    return {'synced': synced, 'failed': failed};
  }

  /// Sync all unsynced attendance records (Feature #4/14 — C2).
  static Future<Map<String, dynamic>> _syncAttendance({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedAttendance();

    if (!silent && unsynced.isNotEmpty) {
      print('📤 Syncing ${unsynced.length} attendance records...');
    }

    int synced = 0;
    int failed = 0;

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    if (token == null) return {'synced': 0, 'failed': unsynced.length};

    for (final record in unsynced) {
      final localId = record['localId'] as String?;
      if (localId == null) continue;

      // Supported actions: check_in (default), check_out, overtime_start, overtime_end.
      final action = (record['action'] as String?) ?? 'check_in';
      final endpoint = switch (action) {
        'check_out' => '/attendance/checkout/',
        'overtime_start' => '/attendance/overtime/start/',
        'overtime_end' => '/attendance/overtime/end/',
        _ => '/attendance/mark/',
      };

      try {
        final resp = await http.post(
          Uri.parse('${ApiService.baseUrl}$endpoint'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            if (record['latitude'] != null) 'latitude': record['latitude'],
            if (record['longitude'] != null) 'longitude': record['longitude'],
            if (record['note'] != null) 'note': record['note'],
          }),
        );
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          int serverId = 0;
          try {
            final body = jsonDecode(resp.body);
            if (body is Map && body['id'] is int) serverId = body['id'] as int;
          } catch (_) {}
          await OfflineStorageService.markAttendanceSynced(localId, serverId);
          synced++;
        } else if (resp.statusCode == 409) {
          // Conflict — server already has today's record; treat as success.
          await OfflineStorageService.markAttendanceSynced(localId, 0);
          synced++;
        } else {
          await OfflineStorageService.markAttendanceFailed(localId);
          failed++;
        }
      } catch (_) {
        await OfflineStorageService.markAttendanceFailed(localId);
        failed++;
      }
    }

    return {'synced': synced, 'failed': failed};
  }

  /// Sync all unsynced photos (Feature #4/14 — C2).
  static Future<Map<String, dynamic>> _syncPhotos({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedPhotos();

    if (!silent && unsynced.isNotEmpty) {
      print('📤 Syncing ${unsynced.length} photos...');
    }

    int synced = 0;
    int failed = 0;

    for (final photo in unsynced) {
      final photoId = photo['id'] as String?;
      final filePath = photo['filePath'] as String?;
      final valuationLocalId = photo['valuationLocalId'] as String?;
      if (photoId == null || filePath == null) {
        failed++;
        continue;
      }

      // Resolve valuation server id — we can only upload photos for a
      // valuation that has already been synced to the server.
      int? valuationServerId;
      if (valuationLocalId != null) {
        final v = OfflineStorageService.getValuationByLocalId(valuationLocalId);
        if (v != null && v['serverId'] is int) {
          valuationServerId = v['serverId'] as int;
        }
      }
      if (valuationServerId == null) {
        // Valuation not yet uploaded — leave photo queued for next pass.
        continue;
      }

      final file = File(filePath);
      if (!await file.exists()) {
        await OfflineStorageService.markPhotoFailed(photoId);
        failed++;
        continue;
      }

      try {
        final result = await ApiService.uploadValuationPhoto(
          valuationServerId,
          filePath,
          caption: photo['caption'] as String?,
          isPrimary: photo['isPrimary'] == true,
          ordering: photo['ordering'] as int?,
          capturedAt: photo['capturedAt'] as String?,
          gpsLat: (photo['gpsLat'] as num?)?.toDouble(),
          gpsLon: (photo['gpsLon'] as num?)?.toDouble(),
          deviceId: photo['deviceId'] as String?,
        );
        if (result['success'] == true) {
          final data = result['data'];
          final serverId = (data is Map && data['id'] is int) ? data['id'] as int : 0;
          await OfflineStorageService.markPhotoSynced(photoId, serverId);
          synced++;
        } else {
          await OfflineStorageService.markPhotoFailed(photoId);
          failed++;
        }
      } catch (_) {
        await OfflineStorageService.markPhotoFailed(photoId);
        failed++;
      }
    }

    return {'synced': synced, 'failed': failed};
  }

  /// Sync queued valuation submit actions.
  static Future<Map<String, dynamic>> _syncSubmitActions({bool silent = false}) async {
    final queued = OfflineStorageService.getUnsyncedSubmitActions();
    if (!silent && queued.isNotEmpty) {
      print('📤 Syncing ${queued.length} queued report submissions...');
    }

    int synced = 0;
    int failed = 0;

    for (final item in queued) {
      final id = item['id']?.toString();
      final valuationId = item['valuationId'];
      if (id == null || valuationId is! int) {
        failed++;
        continue;
      }

      try {
        await OfflineStorageService.markSubmitActionSyncing(id);
        final result = await ApiService.submitValuation(valuationId);
        if (result['success'] == true) {
          await OfflineStorageService.markSubmitActionSynced(id);
          synced++;
          _notifyListeners('submissionSynced', {'valuationId': valuationId});
        } else {
          await OfflineStorageService.markSubmitActionFailed(id);
          failed++;
        }
      } catch (_) {
        await OfflineStorageService.markSubmitActionFailed(id);
        failed++;
      }
    }

    return {'synced': synced, 'failed': failed};
  }

  /// Get sync status
  static Future<Map<String, dynamic>> getStatus() async {
    try {
      final stats = OfflineStorageService.getStats();
      return {
        'pendingValuations': stats['unsynced_valuations'] ?? 0,
        'pendingAttendance': stats['unsynced_attendance'] ?? 0,
        'pendingPhotos': stats['unsynced_photos'] ?? 0,
        'pendingSubmitActions': stats['unsynced_submit_actions'] ?? 0,
        'isOnline': NetworkService.isOnline,
        'isSyncing': _isSyncing,
        'isInitialized': _isInitialized,
      };
    } catch (e) {
      // Return default status if database not initialized
      return {
        'pendingValuations': 0,
        'pendingAttendance': 0,
        'pendingPhotos': 0,
        'pendingSubmitActions': 0,
        'isOnline': NetworkService.isOnline,
        'isSyncing': false,
        'isInitialized': false,
      };
    }
  }

  /// Dispose resources
  static void dispose() {
    _networkSubscription?.cancel();
    _periodicSyncTimer?.cancel();
    _listeners.clear();
    _isInitialized = false;
  }

}

