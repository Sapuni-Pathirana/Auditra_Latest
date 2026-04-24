import 'package:flutter/material.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final result = await ApiService.getNotifications();
    if (!mounted) return;
    if (result['success'] == true) {
      final raw = result['data'];
      final list = raw is List ? raw : (raw['results'] ?? []);
      setState(() {
        _notifications = List<Map<String, dynamic>>.from(list as List);
        _loading = false;
      });
    } else {
      setState(() { _error = result['message'] ?? 'Failed to load'; _loading = false; });
    }
  }

  Future<void> _markRead(int id) async {
    await ApiService.markNotificationRead(id);
    _load();
  }

  Future<void> _markAllRead() async {
    await ApiService.markAllNotificationsRead();
    _load();
  }

  Color _severityColor(String? sev) {
    switch (sev) {
      case 'critical':
        return Colors.red;
      case 'warning':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton.icon(
            onPressed: _markAllRead,
            icon: const Icon(Icons.done_all),
            label: const Text('All read'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _notifications.isEmpty
                  ? const Center(child: Text('No notifications'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final n = _notifications[i];
                          final isRead = n['is_read'] == true;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: _severityColor(n['severity'] as String?).withAlpha(30),
                              child: Icon(
                                Icons.notifications,
                                color: _severityColor(n['severity'] as String?),
                                size: 20,
                              ),
                            ),
                            title: Text(
                              n['title'] ?? '',
                              style: TextStyle(
                                fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                              ),
                            ),
                            subtitle: Text(
                              n['message'] ?? '',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: isRead
                                ? null
                                : IconButton(
                                    icon: const Icon(Icons.circle, size: 10, color: Colors.blue),
                                    onPressed: () => _markRead(n['id'] as int),
                                    tooltip: 'Mark read',
                                  ),
                            tileColor: isRead ? null : Theme.of(context).colorScheme.primary.withAlpha(10),
                          );
                        },
                      ),
                    ),
    );
  }
}
