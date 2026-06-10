import 'package:flutter/material.dart';
import 'dart:async';
import '../services/sync_engine.dart';
import '../services/network_service.dart';

/// A small pill-shaped badge displayed in the app bar that shows network and sync status.
///
/// Possible appearances:
///   - White pill, cloud-done icon, "Online"  — connected, nothing pending.
///   - Orange pill, cloud-off icon, "Offline"  — no internet connection.
///   - White pill, spinning loader + orange badge number — actively uploading queued items.
///
/// Tapping the pill triggers an immediate manual sync if the device is online
/// and there are pending items waiting to be uploaded to the server.
class SyncStatusIndicator extends StatefulWidget {
  const SyncStatusIndicator({super.key});

  @override
  State<SyncStatusIndicator> createState() => _SyncStatusIndicatorState();
}

/// State class for [SyncStatusIndicator].
///
/// Tracks three values that drive the pill's appearance:
///   - `_isOnline`     — true when the device has a working internet connection.
///   - `_isSyncing`    — true while the sync engine is actively uploading data.
///   - `_pendingCount` — total number of items in all offline queues combined.
class _SyncStatusIndicatorState extends State<SyncStatusIndicator> {
  bool _isOnline = true;       // Is the device currently connected to the internet?
  bool _isSyncing = false;     // Is a sync upload pass running right now?
  int _pendingCount = 0;       // Total queued items across all four offline queues
  StreamSubscription? _networkSubscription; // Cancels the network listener on dispose
  Function(Map<String, dynamic>)? _syncListener; // Cancels the sync event listener on dispose
  DateTime? _lastLoadTime;     // Tracks the last time _loadStatus ran (for debouncing)
  static const _loadDebounceMs = 500; // Do not reload faster than once every 500 ms

  /// Called once when the widget is first inserted into the widget tree.
  /// Loads the current sync status immediately, then sets up live listeners
  /// so the pill updates automatically whenever network state or sync events change.
  @override
  void initState() {
    super.initState();
    _loadStatus();
    _setupListeners();
  }

  /// Reads the latest sync status from [SyncEngine] and updates this widget's state.
  ///
  /// Includes a 500 ms debounce: if called multiple times in rapid succession
  /// (e.g. many network events at once), only the first call within each
  /// 500 ms window actually runs. Pass `force: true` to always reload immediately
  /// regardless of the debounce timer.
  ///
  /// Falls back to safe defaults (online = true, syncing = false, pending = 0)
  /// if [NetworkService] or [SyncEngine] are not yet initialised.
  Future<void> _loadStatus({bool force = false}) async {
    // Debounce rapid calls
    final now = DateTime.now();
    if (!force && _lastLoadTime != null) {
      final timeSinceLastLoad = now.difference(_lastLoadTime!);
      if (timeSinceLastLoad.inMilliseconds < _loadDebounceMs) {
        return; // Skip if called too soon
      }
    }
    _lastLoadTime = now;

    try {
      // Check if network service is initialized first
      if (!NetworkService.isInitialized) {
        // Network service not ready, use defaults
        if (mounted) {
          setState(() {
            _isOnline = true;
            _isSyncing = false;
            _pendingCount = 0;
          });
        }
        return;
      }
      
      final status = await SyncEngine.getStatus();
      if (mounted) {
        setState(() {
          _isOnline = status['isOnline'] as bool;
          // Only update syncing state if it's actually syncing, or if it was syncing and now it's not
          final isSyncingFromEngine = status['isSyncing'] as bool;
          if (isSyncingFromEngine) {
            _isSyncing = true;
          } else if (_isSyncing && !isSyncingFromEngine) {
            // Was syncing, now it's done
            _isSyncing = false;
          }
          _pendingCount = (status['pendingValuations'] as int? ?? 0) +
              (status['pendingAttendance'] as int? ?? 0) +
              (status['pendingPhotos'] as int? ?? 0) +
              (status['pendingSubmitActions'] as int? ?? 0);
        });
      }
    } catch (e) {
      // Database not initialized yet or error, use default values
      if (mounted) {
        setState(() {
          _isOnline = NetworkService.isOnline;
          _isSyncing = false;
          _pendingCount = 0;
        });
      }
    }
  }

  /// Registers two live listeners so the pill updates automatically:
  ///
  ///   1. **Network stream** — rebuilds the online/offline indicator the moment
  ///      connectivity changes (Wi-Fi drops, mobile data reconnects, etc.).
  ///      A 300 ms delay is added before reloading the full status to let the
  ///      connection stabilise first.
  ///
  ///   2. **SyncEngine listener** — reacts to specific sync lifecycle events:
  ///      - `syncStart`     — shows the spinning loader.
  ///      - `syncComplete` / `syncError` — hides the loader, refreshes count.
  ///      - `valuationSynced` — refreshes the pending count badge.
  ///      - `syncSuccess`   — hides loader, refreshes count, shows a green snackbar.
  void _setupListeners() {
    _networkSubscription = NetworkService.networkStatusStream.listen((isOnline) {
      if (mounted) {
        setState(() {
          _isOnline = isOnline;
        });
        // Debounce network status changes
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _loadStatus(force: true);
        });
      }
    });

    // Listen to sync events
    _syncListener = (event) {
      if (!mounted) return;
      
      final eventType = event['event'] as String?;
      
      if (eventType == 'syncStart') {
        setState(() {
          _isSyncing = true;
        });
      } else if (eventType == 'syncComplete' || eventType == 'syncError') {
        setState(() {
          _isSyncing = false;
        });
        // Refresh pending count after a short delay to ensure state is updated
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) _loadStatus(force: true);
        });
      } else if (eventType == 'valuationSynced') {
        // Don't update syncing state, just refresh count
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) _loadStatus(force: true);
        });
      } else if (eventType == 'syncSuccess') {
        setState(() {
          _isSyncing = false;
        });
        // Refresh pending count
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted) _loadStatus(force: true);
        });
        // Show success message via ScaffoldMessenger if context is available
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(event['message'] ?? 'Sync completed successfully'),
              backgroundColor: const Color(0xFF84BCDA),
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    };
    SyncEngine.addListener(_syncListener!);
  }

  /// Cancels the network subscription and removes the sync listener when this
  /// widget is removed from the screen. This prevents memory leaks and stops
  /// setState being called on a widget that no longer exists.
  @override
  void dispose() {
    _networkSubscription?.cancel();
    if (_syncListener != null) {
      SyncEngine.removeListener(_syncListener!);
    }
    super.dispose();
  }

  /// Called when the user taps the pill badge.
  /// Triggers an immediate full sync only if all three conditions are met:
  ///   (a) the device is currently online,
  ///   (b) there is at least one pending item in the queue, and
  ///   (c) no sync pass is already running.
  /// After the sync finishes, refreshes the pending count.
  Future<void> _handleManualSync() async {
    if (_isOnline && _pendingCount > 0 && !_isSyncing) {
      await SyncEngine.syncAll();
      _loadStatus();
    }
  }

  /// Builds the pill-shaped container that shows network / sync status.
  ///
  /// Layout inside the pill (left to right):
  ///   - Left icon: spinning CircularProgressIndicator while uploading,
  ///     otherwise cloud-done (online) or cloud-off (offline).
  ///   - Label: "Online" or "Offline" in matching colour.
  ///   - Orange badge (right side): only shown when `_pendingCount > 0`;
  ///     displays the number of queued items waiting to upload.
  ///
  /// The whole pill is wrapped in a [GestureDetector] so tapping it
  /// calls [_handleManualSync].
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleManualSync,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: _isOnline 
              ? Colors.white.withOpacity(0.15) 
              : Colors.orange.withOpacity(0.2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _isOnline 
                ? Colors.white.withOpacity(0.4) 
                : Colors.orangeAccent,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Only show loading if actually syncing AND there's something to sync
            (_isSyncing && _pendingCount > 0)
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _isOnline ? Colors.white : Colors.white,
                      ),
                    ),
                  )
                : Icon(
                    _isOnline ? Icons.cloud_done : Icons.cloud_off,
                    size: 16,
                    color: _isOnline ? Colors.white : Colors.orangeAccent,
                  ),
            const SizedBox(width: 6),
            Text(
              _isOnline ? 'Online' : 'Offline',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _isOnline ? Colors.white : Colors.orangeAccent,
              ),
            ),
            if (_pendingCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.orange,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$_pendingCount',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

