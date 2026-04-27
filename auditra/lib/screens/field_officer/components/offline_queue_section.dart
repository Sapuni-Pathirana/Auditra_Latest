import 'package:flutter/material.dart';
import 'dart:async';
import '../../../services/offline_storage_service.dart';
import '../../../services/network_service.dart';
import '../../../services/sync_engine.dart';

class OfflineQueueSection extends StatefulWidget {
  const OfflineQueueSection({super.key});

  @override
  State<OfflineQueueSection> createState() => _OfflineQueueSectionState();
}

class _OfflineQueueSectionState extends State<OfflineQueueSection> {
  List<Map<String, dynamic>> _unsyncedValuations = [];
  List<Map<String, dynamic>> _unsyncedSubmitActions = [];
  bool _isOnline = true;
  bool _isSyncing = false;
  StreamSubscription<bool>? _networkSubscription;
  Function(Map<String, dynamic>)? _syncListener;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _refreshQueue();
    _setupListeners();
  }

  @override
  void dispose() {
    _networkSubscription?.cancel();
    _pollTimer?.cancel();
    if (_syncListener != null) {
      SyncEngine.removeListener(_syncListener!);
    }
    super.dispose();
  }

  void _setupListeners() {
    _networkSubscription = NetworkService.networkStatusStream.listen((_) {
      if (!mounted) return;
      _refreshQueue();
    });

    _syncListener = (event) {
      if (!mounted) return;
      final eventType = event['event'] as String?;
      if (eventType == 'syncStart') {
        setState(() => _isSyncing = true);
      } else if (eventType == 'syncComplete' || eventType == 'syncError' || eventType == 'syncSuccess' || eventType == 'valuationSynced') {
        _refreshQueue();
      }
    };
    SyncEngine.addListener(_syncListener!);

    // Fallback polling keeps queue status fresh even if parent does not rebuild.
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) _refreshQueue();
    });
  }

  void _refreshQueue() {
    final unsyncedValuations = OfflineStorageService.getUnsyncedValuations();
    final unsyncedSubmitActions = OfflineStorageService.getUnsyncedSubmitActions();
    final isOnline = NetworkService.isOnline;
    if (!mounted) return;
    setState(() {
      _unsyncedValuations = unsyncedValuations;
      _unsyncedSubmitActions = unsyncedSubmitActions;
      _isOnline = isOnline;
      if (_unsyncedValuations.isEmpty && _unsyncedSubmitActions.isEmpty) {
        _isSyncing = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Don't show queue if there are no unsynced items
    final totalQueued = _unsyncedValuations.length + _unsyncedSubmitActions.length;
    if (totalQueued == 0) {
      return const SizedBox.shrink();
    }
    
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange[300]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.cloud_upload, color: Colors.orange[700], size: 24),
              const SizedBox(width: 8),
              Text(
                'Offline Queue',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.orange[900],
                ),
              ),
              const Spacer(),
              Chip(
                label: Text(
                  '$totalQueued',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                ),
                backgroundColor: Colors.orange[700],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _isOnline 
              ? (_isSyncing
                  ? 'Uploading queued reports... They will disappear after successful sync.'
                  : 'Internet restored. Queued reports will upload automatically.')
              : 'Reports saved offline. They will be submitted when internet connects.',
            style: TextStyle(
              fontSize: 14,
              color: Colors.orange[800],
            ),
          ),
          const SizedBox(height: 12),
          ..._unsyncedValuations.take(3).map((valuation) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Icon(Icons.description, size: 16, color: Colors.orange[700]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${valuation['category'] ?? 'Valuation'} - ${valuation['description'] ?? 'No description'}',
                    style: TextStyle(fontSize: 13, color: Colors.orange[900]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (_isOnline && _isSyncing)
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.orange[700]!),
                    ),
                  )
                else if (!_isOnline)
                  Icon(Icons.cloud_off, size: 16, color: Colors.orange[700]),
              ],
            ),
          )),
          ..._unsyncedSubmitActions.take(2).map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Icon(Icons.outbox_rounded, size: 16, color: Colors.orange[700]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Queued submit: ${item['projectTitle'] ?? 'Valuation #${item['valuationId'] ?? '-'}'}',
                    style: TextStyle(fontSize: 13, color: Colors.orange[900]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (_isOnline && _isSyncing)
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.orange[700]!),
                    ),
                  )
                else if (!_isOnline)
                  Icon(Icons.cloud_off, size: 16, color: Colors.orange[700]),
              ],
            ),
          )),
          if (totalQueued > 5)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'And ${totalQueued - 5} more...',
                style: TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: Colors.orange[700],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
