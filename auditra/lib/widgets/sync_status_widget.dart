import 'dart:async';
import 'package:flutter/material.dart';
import '../services/sync_engine.dart';
import '../services/network_service.dart';
import '../theme/app_colors.dart';

/// A thin banner bar (full-width) shown below the app bar when there is
/// something worth notifying the user about:
///
///   - **Offline** (orange)  — no internet; shows how many items are queued.
///   - **Syncing…** (blue)   — a sync pass is actively uploading right now.
///   - **N items queued** (blue) — online but items are still waiting to upload.
///
/// When the device is online with nothing pending and no sync running,
/// the widget returns an empty [SizedBox] and takes up no space at all.
///
/// Tapping the banner (when online and items are pending) triggers an
/// immediate manual sync via [SyncEngine.syncAll].
class SyncStatusWidget extends StatefulWidget {
  const SyncStatusWidget({super.key});

  @override
  State<SyncStatusWidget> createState() => _SyncStatusWidgetState();
}

class _SyncStatusWidgetState extends State<SyncStatusWidget> {
  // Holds the latest status map returned by SyncEngine.getStatus().
  // Keys: pendingValuations, isOnline, isSyncing.
  Map<String, dynamic> _status = {
    'pendingValuations': 0,
    'isOnline': true,
    'isSyncing': false,
  };
  Timer? _timer;                      // Fires _refresh every 5 seconds as a safety net
  StreamSubscription<bool>? _netSub; // Listens for network connect/disconnect events

  /// Called once when the banner is first shown.
  /// - Loads the initial status immediately.
  /// - Starts a 5-second periodic timer so the badge stays up to date even if
  ///   no events fire (e.g. when the app resumes from the background).
  /// - Subscribes to the network stream and sync events for instant updates.
  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
    _netSub = NetworkService.networkStatusStream.listen((_) => _refresh());
    SyncEngine.addListener(_onSyncEvent);
  }

  /// Stops the periodic timer, cancels the network subscription, and
  /// unregisters the sync event listener to prevent memory leaks.
  @override
  void dispose() {
    _timer?.cancel();
    _netSub?.cancel();
    SyncEngine.removeListener(_onSyncEvent);
    super.dispose();
  }

  /// Called by [SyncEngine] whenever a sync event fires (start, complete, error, etc.).
  /// Simply triggers a status refresh so the banner reflects the latest state.
  void _onSyncEvent(Map<String, dynamic> event) {
    _refresh();
  }

  /// Fetches the latest sync status from [SyncEngine] and rebuilds the widget.
  Future<void> _refresh() async {
    final s = await SyncEngine.getStatus();
    if (mounted) setState(() => _status = s);
  }

  /// Builds the banner or an empty box.
  ///
  /// State-to-UI mapping:
  ///   - offline                    → orange banner, cloud-off icon, "Offline – N items queued".
  ///   - online + syncing           → blue banner, spinning loader, "Syncing…".
  ///   - online + pending (no sync) → blue banner, cloud-upload icon, "N items queued".
  ///   - online + nothing pending   → invisible [SizedBox.shrink()].
  ///
  /// Tapping the blue "items queued" state calls [SyncEngine.syncAll] immediately.
  @override
  Widget build(BuildContext context) {
    final isOnline = _status['isOnline'] == true;
    final isSyncing = _status['isSyncing'] == true;
    final pending = _status['pendingValuations'] as int? ?? 0;

    if (isOnline && pending == 0 && !isSyncing) return const SizedBox.shrink();

    Color bg;
    IconData icon;
    String label;

    if (!isOnline) {
      bg = AppColors.warning;
      icon = Icons.cloud_off;
      label = 'Offline – $pending item${pending != 1 ? 's' : ''} queued';
    } else if (isSyncing) {
      bg = AppColors.info;
      icon = Icons.sync;
      label = 'Syncing…';
    } else if (pending > 0) {
      bg = AppColors.info;
      icon = Icons.cloud_upload;
      label = '$pending item${pending != 1 ? 's' : ''} queued';
    } else {
      return const SizedBox.shrink();
    }

    return Material(
      color: bg,
      child: InkWell(
        onTap: isOnline && pending > 0 ? () => SyncEngine.syncAll() : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              isSyncing
                  ? const SizedBox(
                      height: 14,
                      width: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Icon(icon, size: 16, color: Colors.white),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
