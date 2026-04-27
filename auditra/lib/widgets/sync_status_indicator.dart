import 'package:flutter/material.dart';
import 'dart:async';
import '../services/sync_engine.dart';
import '../services/network_service.dart';

/// Widget to display sync status and network connectivity
class SyncStatusIndicator extends StatefulWidget {
  const SyncStatusIndicator({super.key});

  @override
  State<SyncStatusIndicator> createState() => _SyncStatusIndicatorState();
}

class _SyncStatusIndicatorState extends State<SyncStatusIndicator> {
  bool _isOnline = true;
  bool _isSyncing = false;
  int _pendingCount = 0;
  StreamSubscription? _networkSubscription;
  Function(Map<String, dynamic>)? _syncListener;
  DateTime? _lastLoadTime;
  static const _loadDebounceMs = 500; // Debounce status loads

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _setupListeners();
  }

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

  void _setupListeners() {
    // Listen to network changes
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

  @override
  void dispose() {
    _networkSubscription?.cancel();
    if (_syncListener != null) {
      SyncEngine.removeListener(_syncListener!);
    }
    super.dispose();
  }

  Future<void> _handleManualSync() async {
    if (_isOnline && _pendingCount > 0 && !_isSyncing) {
      await SyncEngine.syncAll();
      _loadStatus();
    }
  }

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

