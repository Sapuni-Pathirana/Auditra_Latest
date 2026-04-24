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

  Color _categoryColor(String? category) {
    switch ((category ?? '').toLowerCase()) {
      case 'chat':
        return const Color(0xFF2563EB);
      case 'document':
        return const Color(0xFF7C3AED);
      case 'project':
        return const Color(0xFF0EA5A4);
      case 'payment':
        return const Color(0xFF059669);
      case 'leave':
        return const Color(0xFFD97706);
      default:
        return const Color(0xFF0284C7);
    }
  }

  IconData _categoryIcon(String? category) {
    switch ((category ?? '').toLowerCase()) {
      case 'chat':
        return Icons.chat_bubble_rounded;
      case 'document':
        return Icons.description_rounded;
      case 'project':
        return Icons.work_rounded;
      case 'payment':
        return Icons.payments_rounded;
      case 'leave':
        return Icons.event_busy_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  String _prettyCategory(String? category) {
    if (category == null || category.isEmpty) return 'General';
    return category[0].toUpperCase() + category.substring(1).toLowerCase();
  }

  String _timeAgo(dynamic value) {
    if (value == null) return '';
    try {
      final dt = DateTime.parse(value.toString()).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inSeconds < 60) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0.6,
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: _notifications.isEmpty ? null : _markAllRead,
              icon: const Icon(Icons.done_all, size: 18),
              label: const Text('All read'),
              style: TextButton.styleFrom(
                foregroundColor: Colors.blue.shade700,
                textStyle: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  ),
                )
              : _notifications.isEmpty
                  ? const Center(
                      child: Text(
                        'No notifications yet',
                        style: TextStyle(fontSize: 15, color: Colors.black54),
                      ),
                    )
                  : Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Text(
                              '${_notifications.where((n) => n['is_read'] != true).length} unread of ${_notifications.length} notifications',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade700,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 18),
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final n = _notifications[i];
                          final isRead = n['is_read'] == true;
                          final categoryColor = _categoryColor(n['category']?.toString());
                          final categoryIcon = _categoryIcon(n['category']?.toString());
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            leading: CircleAvatar(
                              radius: 22,
                              backgroundColor: categoryColor.withAlpha(22),
                              child: Icon(
                                categoryIcon,
                                color: categoryColor,
                                size: 19,
                              ),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    n['title'] ?? '',
                                    style: TextStyle(
                                      fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                      fontSize: 16,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ),
                                Text(
                                  _timeAgo(n['created_at']),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade600,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    margin: const EdgeInsets.only(bottom: 5),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: categoryColor.withAlpha(20),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      _prettyCategory(n['category']?.toString()),
                                      style: TextStyle(
                                        color: categoryColor,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    n['message'] ?? '',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Colors.grey.shade800,
                                      fontSize: 14,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            trailing: isRead
                                ? null
                                : GestureDetector(
                                    onTap: () => _markRead(n['id'] as int),
                                    child: Container(
                                      width: 10,
                                      height: 10,
                                      decoration: const BoxDecoration(
                                        color: Colors.blue,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(
                                color: isRead ? Colors.grey.shade200 : categoryColor.withAlpha(80),
                              ),
                            ),
                            tileColor: isRead ? Colors.white : categoryColor.withAlpha(12),
                          );
                        },
                      ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
