import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'network_service.dart';
import 'offline_storage_service.dart';
import 'offline_db_service.dart';

/// Automatically uploads locally saved data to the server when the device goes online.
///
/// When a field officer works offline, data is stored locally by [OfflineStorageService].
/// This engine watches the network and runs the upload automatically as soon as
/// internet is available. It handles four types of queued data in order:
///   1. Valuations  — draft reports created offline.
///   2. Attendance  — check-in / check-out / overtime records.
///   3. Photos      — evidence photos taken offline (uploaded after their valuation).
///   4. Submit actions — "submit to accessor" requests queued while offline.
///
/// Triggers:
///   - Automatically when the device transitions from offline → online.
///   - Every 5 minutes in the background (periodic timer) as a safety net.
///   - Manually when the user taps the sync badge in the app bar.
///
/// Listeners can register callbacks with [addListener] to react to sync events
/// (e.g. update UI counters, show a snackbar on success).
class SyncEngine {
  static bool _isInitialized = false;
  static bool _isSyncing = false;
  static StreamSubscription<bool>? _networkSubscription;
  static Timer? _periodicSyncTimer;
  static final List<Function(Map<String, dynamic>)> _listeners = [];
  static bool _wasOffline = false;

  /// Starts the sync engine for the current field-officer session.
  ///
  /// What `init` does:
  ///   1. Skips if already initialised (safe to call multiple times).
  ///   2. Checks the user's role — exits quietly if not a field officer.
  ///   3. Starts [NetworkService] so the engine can watch connectivity changes.
  ///   4. Subscribes to the network stream: the moment connectivity is restored
  ///      after an offline period it schedules a sync (1-second delay to let
  ///      the connection stabilise first).
  ///   5. At startup, if we are already online and have unsynced items, queues
  ///      an immediate background sync (2-second delay).
  ///   6. Starts a 5-minute periodic timer for background sync as a safety net.
  static Future<void> init() async {
    if (_isInitialized) {
      print('Sync engine already initialized');
      return;
    }

    // Check if offline mode is enabled
    if (!await OfflineDBService.isOfflineModeEnabled()) {
      print('Sync engine not needed (offline mode disabled)');
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
          print('Network restored (was offline) - triggering sync');
          Future.delayed(const Duration(seconds: 1), () {
            syncAll();
          });
        }
        // Don't sync if already online - items should go directly to server
        _wasOffline = false;
      } else {
        print('Network lost');
        _wasOffline = true;
      }
    });

    // Initial sync check: only if we were offline and now online, or if there are unsynced items
    if (NetworkService.isOnline) {
      // Check if there are unsynced items that need syncing
      final unsyncedValuations = OfflineStorageService.getUnsyncedValuations();
      if (unsyncedValuations.isNotEmpty) {
        print('Online with ${unsyncedValuations.length} unsynced items - syncing now');
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
    print('Sync engine initialized');
  }

  /// Registers a callback that will be called every time the engine fires a sync event.
  ///
  /// Events that can arrive (passed as `event['event']`):
  ///   - `syncStart`          — sync has begun.
  ///   - `syncComplete`       — all items processed; includes `synced` and `failed` counts.
  ///   - `syncError`          — unhandled error during sync.
  ///   - `syncSuccess`        — at least one item was uploaded successfully.
  ///   - `valuationSynced`    — a specific valuation was uploaded.
  ///   - `itemStatusChanged`  — a single item's status changed (e.g. Queued → Syncing).
  ///   - `conflictResolved`   — a duplicate was found on the server and resolved.
  ///   - `submissionSynced`   — a queued submit action was sent to the server.
  static void addListener(Function(Map<String, dynamic>) listener) {
    _listeners.add(listener);
  }

  /// Removes a previously registered listener so it no longer receives events.
  /// Always call this in `dispose()` to prevent memory leaks.
  static void removeListener(Function(Map<String, dynamic>) listener) {
    _listeners.remove(listener);
  }

  /// Broadcasts a sync event to every registered listener.
  /// Errors inside individual listeners are caught and printed so one bad
  /// listener cannot break the rest of the sync flow.
  static void _notifyListeners(String event, Map<String, dynamic> data) {
    for (var listener in _listeners) {
      try {
        listener({'event': event, ...data});
      } catch (e) {
        print('Error in sync listener: $e');
      }
    }
  }

  /// Converts an integer sync-status code into a readable string label.
  /// 0 → 'Queued', 1 → 'Synced', 2 → 'Syncing', 3 → 'Failed'.
  static String syncStatusLabel(int code) {
    switch (code) {
      case 0: return 'Queued';
      case 1: return 'Synced';
      case 2: return 'Syncing';
      case 3: return 'Failed';
      default: return 'Unknown';
    }
  }

  /// Uploads all pending offline data to the server in one pass.
  ///
  /// Order of operations:
  ///   1. Skips if another sync is already running (prevents double-uploads).
  ///   2. Skips if the device is offline.
  ///   3. Skips if there is nothing to upload (avoids pointless API calls).
  ///   4. Uploads valuations, then attendance, then photos, then submit actions.
  ///   5. Fires `syncComplete` event with total counts when done.
  ///
  /// Pass `silent: true` to suppress console output (used by the periodic timer).
  static Future<void> syncAll({bool silent = false}) async {
    if (_isSyncing) {
      if (!silent) print('Sync already in progress');
      return;
    }

    if (!NetworkService.isOnline) {
      if (!silent) print('Offline - skipping sync');
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
      if (!silent) print('No unsynced items - skipping sync');
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
        print('Sync complete: $syncedCount synced, $failedCount failed');
      }

      _notifyListeners('syncComplete', {
        'synced': syncedCount,
        'failed': failedCount,
      });
    } catch (e) {
      print('Sync error: $e');
      _notifyListeners('syncError', {'error': e.toString()});
    } finally {
      _isSyncing = false;
    }
  }

  /// Convenience wrapper that calls [syncAll] without any console output.
  /// Called by the 5-minute background timer to avoid noisy logs.
  static Future<void> syncAllSilent() {
    return syncAll(silent: true);
  }

  /// Uploads a single offline valuation to the server.
  ///
  /// Steps:
  ///   1. Loads the valuation from local storage by its UUID.
  ///   2. Skips if it is already synced.
  ///   3. Marks the status as Syncing (2) so the UI can show a spinner.
  ///   4. Strips local-only fields (localId, syncStatus, etc.) before sending.
  ///   5. Calls `ApiService.syncValuationToServer`.
  ///   6. On success: marks the record as Synced and stores the server ID.
  ///   7. On 409 Conflict (duplicate on server): resolves by treating the
  ///      existing server record as the winner (last-write-wins).
  ///   8. On any other failure: marks as Failed so it will be retried later.
  ///
  /// Returns a map with `success: true/false` and optional `serverId`.
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

  /// Loops through all unsynced valuations and calls [syncValuation] for each.
  /// After all uploads are complete, calls [cleanupSyncedValuations] to remove
  /// successfully synced records from the local database.
  /// Returns `{'synced': N, 'failed': N}`.
  static Future<Map<String, dynamic>> _syncValuations({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedValuations();
    
    if (!silent && unsynced.isNotEmpty) {
      print('Syncing ${unsynced.length} valuations...');
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

  /// Uploads all unsynced attendance records (check-in, check-out, overtime).
  ///
  /// Each record's `action` field determines which API endpoint to call:
  ///   - `check_in`       → POST /attendance/mark/
  ///   - `check_out`      → POST /attendance/checkout/
  ///   - `overtime_start` → POST /attendance/overtime/start/
  ///   - `overtime_end`   → POST /attendance/overtime/end/
  ///
  /// A 409 Conflict (server already has today's record) is treated as success.
  /// Returns `{'synced': N, 'failed': N}`.
  static Future<Map<String, dynamic>> _syncAttendance({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedAttendance();

    if (!silent && unsynced.isNotEmpty) {
      print('Syncing ${unsynced.length} attendance records...');
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

  /// Uploads all offline photos whose valuation has already been uploaded.
  ///
  /// Photos depend on the valuation existing on the server first (because
  /// the API links the photo to the valuation's server ID). If a photo's
  /// valuation is not yet synced, the photo is skipped and left queued for
  /// the next pass (when the valuation will have been uploaded).
  ///
  /// Uses `ApiService.uploadValuationPhoto` which sends GPS metadata,
  /// caption, and ordering alongside the image bytes.
  /// Returns `{'synced': N, 'failed': N}`.
  static Future<Map<String, dynamic>> _syncPhotos({bool silent = false}) async {
    final unsynced = OfflineStorageService.getUnsyncedPhotos();

    if (!silent && unsynced.isNotEmpty) {
      print('Syncing ${unsynced.length} photos...');
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

  /// Processes queued "submit to accessor" actions.
  ///
  /// Each entry in the queue was created when the field officer tapped
  /// "Submit to Accessor" while offline. This method calls
  /// `ApiService.submitValuation` for each entry, which triggers the server
  /// to change the valuation status to "submitted" and notify the accessor.
  /// Returns `{'synced': N, 'failed': N}`.
  static Future<Map<String, dynamic>> _syncSubmitActions({bool silent = false}) async {
    final queued = OfflineStorageService.getUnsyncedSubmitActions();
    if (!silent && queued.isNotEmpty) {
      print('Syncing ${queued.length} queued report submissions...');
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

  /// Returns a snapshot of the current sync state as a plain map.
  ///
  /// Keys returned:
  ///   - `pendingValuations`    — number of unsynced valuation records.
  ///   - `pendingAttendance`    — number of unsynced attendance records.
  ///   - `pendingPhotos`        — number of unsynced photos.
  ///   - `pendingSubmitActions` — number of queued submit actions.
  ///   - `isOnline`             — true if the device has network right now.
  ///   - `isSyncing`            — true if a sync pass is currently running.
  ///   - `isInitialized`        — true if [init] has completed.
  ///
  /// Returns all-zero counts if the database is not yet initialised.
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

  /// Stops the network listener and the periodic timer and clears all registered
  /// listeners. Call this when the user logs out so the engine does not continue
  /// running in the background after the session ends.
  static void dispose() {
    _networkSubscription?.cancel();
    _periodicSyncTimer?.cancel();
    _listeners.clear();
    _isInitialized = false;
  }

}

