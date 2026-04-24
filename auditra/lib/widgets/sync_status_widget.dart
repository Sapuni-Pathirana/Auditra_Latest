import 'dart:async';
import 'package:flutter/material.dart';
import '../services/sync_engine.dart';
import '../services/network_service.dart';
import '../theme/app_colors.dart';

/// A compact status bar that shows online/offline state and queued sync items.
class SyncStatusWidget extends StatefulWidget {
  const SyncStatusWidget({super.key});

  @override
  State<SyncStatusWidget> createState() => _SyncStatusWidgetState();
}

class _SyncStatusWidgetState extends State<SyncStatusWidget> {
  Map<String, dynamic> _status = {
    'pendingValuations': 0,
    'isOnline': true,
    'isSyncing': false,
  };
  Timer? _timer;
  StreamSubscription<bool>? _netSub;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
    _netSub = NetworkService.networkStatusStream.listen((_) => _refresh());
    SyncEngine.addListener(_onSyncEvent);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _netSub?.cancel();
    SyncEngine.removeListener(_onSyncEvent);
    super.dispose();
  }

  void _onSyncEvent(Map<String, dynamic> event) {
    _refresh();
  }

  Future<void> _refresh() async {
    final s = await SyncEngine.getStatus();
    if (mounted) setState(() => _status = s);
  }

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
