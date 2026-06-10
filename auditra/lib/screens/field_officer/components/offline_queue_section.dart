import 'package:flutter/material.dart';
import 'dart:async';
import '../../../services/offline_storage_service.dart';
import '../../../services/network_service.dart';
import '../../../services/sync_engine.dart';

/// A widget that shows the "Offline Queue" banner at the top of the dashboard.
///
/// When the device has no internet, reports are saved locally instead of
/// being sent to the server. This widget tells the field officer:
///   - How many reports are waiting to be uploaded.
///   - Whether the device is currently online or offline.
///   - Whether the sync upload is in progress.
///
/// The banner disappears automatically once all queued reports are uploaded.
class OfflineQueueSection extends StatefulWidget {
  const OfflineQueueSection({super.key});

  @override
  State<OfflineQueueSection> createState() => _OfflineQueueSectionState();
}

class _OfflineQueueSectionState extends State<OfflineQueueSection> {
  //  State variables 

  List<Map<String, dynamic>> _unsyncedValuations = [];    // Reports saved offline but not yet uploaded
  List<Map<String, dynamic>> _unsyncedSubmitActions = []; // Submit-to-accessor actions queued offline
  bool _isOnline = true;    // True when the device has internet access
  bool _isSyncing = false;  // True while the sync engine is actively uploading
  StreamSubscription<bool>? _networkSubscription; // Listens for internet on/off changes
  Function(Map<String, dynamic>)? _syncListener;  // Listens for events from the sync engine
  Timer? _pollTimer; // Backup timer that re-checks the queue every 3 seconds

  //  Lifecycle 

  /// Called once when this widget is first placed on screen.
  /// Loads the current queue immediately and starts all the listeners
  /// so the UI stays up to date automatically.
  @override
  void initState() {
    super.initState();
    _refreshQueue();
    _setupListeners();
  }

  /// Called when this widget is removed from the screen.
  /// Cancels all active listeners and timers to prevent memory leaks
  /// and avoid calling `setState` on a widget that no longer exists.
  @override
  void dispose() {
    _networkSubscription?.cancel();
    _pollTimer?.cancel();
    if (_syncListener != null) {
      SyncEngine.removeListener(_syncListener!);
    }
    super.dispose();
  }

  //  Listeners 

  /// Sets up three separate watchers that keep the queue display fresh:
  ///
  /// 1. **Network listener** — when the internet connection changes (on or off),
  ///    refresh the queue so the correct status message is shown.
  ///
  /// 2. **Sync engine listener** — when the background sync engine fires an event
  ///    (e.g. started uploading, finished uploading, or encountered an error),
  ///    update the spinning indicator and refresh the item list.
  ///
  /// 3. **Fallback poll timer** — every 3 seconds, refresh the queue regardless.
  ///    This catches any edge cases where the listeners did not fire, ensuring
  ///    the badge count and item list are always accurate.
  void _setupListeners() {
    _networkSubscription = NetworkService.networkStatusStream.listen((_) {
      if (!mounted) return;
      _refreshQueue();
    });

    _syncListener = (event) {
      if (!mounted) return;
      final eventType = event['event'] as String?;
      if (eventType == 'syncStart') {
        // Show the spinning indicator while upload is in progress
        setState(() => _isSyncing = true);
      } else if (eventType == 'syncComplete' || eventType == 'syncError' || eventType == 'syncSuccess' || eventType == 'valuationSynced') {
        // Upload finished (success or failure) — re-read the queue to update the list
        _refreshQueue();
      }
    };
    SyncEngine.addListener(_syncListener!);

    // Fallback polling keeps queue status fresh even if parent does not rebuild.
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) _refreshQueue();
    });
  }

  //  Data 

  /// Reads the current offline queue from local storage and updates the UI.
  ///
  /// It fetches:
  ///   - [_unsyncedValuations]   — reports that were saved offline and not yet uploaded.
  ///   - [_unsyncedSubmitActions] — submit-to-accessor actions that were queued offline.
  ///   - [_isOnline]             — current internet connectivity status.
  ///
  /// If both lists are empty, it also clears the syncing spinner because
  /// there is nothing left to upload.
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
        // Nothing left in the queue — stop showing the spinner
        _isSyncing = false;
      }
    });
  }

  //  UI 

  /// Builds the offline queue banner.
  ///
  /// Returns an invisible empty widget if there is nothing queued
  /// (so the banner takes up zero space when all reports are synced).
  ///
  /// Otherwise it draws an orange card that shows:
  ///   - A status message (offline / waiting to upload / uploading now).
  ///   - Up to 3 unsynced valuation report rows with a spinner or cloud-off icon.
  ///   - Up to 2 queued submit-action rows.
  ///   - An "And X more..." line if there are more than 5 items total.
  @override
  Widget build(BuildContext context) {
    // Don't show queue if there are no unsynced items
    final totalQueued = _unsyncedValuations.length + _unsyncedSubmitActions.length;
    if (totalQueued == 0) {
      // Nothing queued — render nothing (takes up zero space)
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
