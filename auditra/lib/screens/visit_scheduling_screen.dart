import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/offline_db_service.dart';
import '../services/offline_storage_service.dart';
import '../theme/app_colors.dart';

class VisitSchedulingScreen extends StatefulWidget {
  final int projectId;
  final String projectTitle;
  final String? appBarTitle;
  final String? fabLabel;
  final String? emptyStateText;
  final String? confirmDialogTitle;
  final String? confirmDialogScheduleLabel;

  const VisitSchedulingScreen({
    super.key,
    required this.projectId,
    required this.projectTitle,
    this.appBarTitle,
    this.fabLabel,
    this.emptyStateText,
    this.confirmDialogTitle,
    this.confirmDialogScheduleLabel,
  });

  @override
  State<VisitSchedulingScreen> createState() => _VisitSchedulingScreenState();
}

class _VisitSchedulingScreenState extends State<VisitSchedulingScreen> {
  List<Map<String, dynamic>> _visits = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCachedVisitsOnStartup();
    _loadVisits();
  }

  Future<void> _loadCachedVisitsOnStartup() async {
    try {
      await OfflineDBService.initOfflineDB();
      final cached = OfflineStorageService.getCachedProjectVisits(widget.projectId);
      if (!mounted) return;
      if (cached != null && cached.isNotEmpty) {
        setState(() {
          _visits = cached;
          _loading = false;
        });
      }
    } catch (_) {
      // best effort only
    }
  }

  Future<void> _loadVisits() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiService.getProjectVisits(widget.projectId);
      if (res['success'] == true) {
        final raw = res['data'];
        final data = raw is List ? raw : <dynamic>[];
        final normalized = List<Map<String, dynamic>>.from(data);
        OfflineStorageService.cacheProjectVisits(widget.projectId, normalized);
        setState(() {
          _visits = normalized;
          _loading = false;
        });
      } else {
        final cached = OfflineStorageService.getCachedProjectVisits(widget.projectId);
        if (cached != null && cached.isNotEmpty) {
          setState(() {
            _visits = cached;
            _loading = false;
            _error = null;
          });
        } else {
          setState(() {
            _error = (res['message'] ?? 'Failed to load valuation dates').toString();
            _loading = false;
          });
        }
      }
    } catch (e) {
      final cached = OfflineStorageService.getCachedProjectVisits(widget.projectId);
      if (cached != null && cached.isNotEmpty) {
        setState(() {
          _visits = cached;
          _loading = false;
          _error = null;
        });
      } else {
        setState(() { _error = e.toString(); _loading = false; });
      }
    }
  }

  bool _isOfflineMessage(String? message) {
    if (message == null) return false;
    final m = message.toLowerCase();
    return m.contains('you are offline') ||
        m.contains('network is unreachable') ||
        m.contains('connection failed') ||
        m.contains('failed host lookup');
  }

  Future<void> _scheduleVisit() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;

    final notesCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(widget.confirmDialogTitle ?? 'Confirm Visit'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Date: ${DateFormat('MMM d, y').format(picked)}'),
            const SizedBox(height: 12),
            TextField(
              controller: notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.confirmDialogScheduleLabel ?? 'Schedule'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final res = await ApiService.scheduleProjectVisit(
        projectId: widget.projectId,
        scheduledDate: picked,
        notes: notesCtrl.text.trim(),
      );

      if (res['success'] == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Visit scheduled. Client will be notified.'), backgroundColor: AppColors.success),
        );
        _loadVisits();
      } else if (mounted) {
        final message = (res['message'] ?? 'Failed to schedule visit').toString();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  String _formatVisitDate(String rawDate) {
    try {
      final parsed = DateTime.parse(rawDate);
      return DateFormat('EEE, MMM d, y').format(parsed);
    } catch (_) {
      return rawDate;
    }
  }

  String _formatStatus(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized.isEmpty) return 'Scheduled';
    return normalized
        .split('_')
        .map((word) => word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
  }

  Color _statusBgColor(String status) {
    switch (status.trim().toLowerCase()) {
      case 'completed':
        return const Color(0xFFE8F5E9);
      case 'cancelled':
        return const Color(0xFFFFEBEE);
      default:
        return const Color(0xFFE3F2FD);
    }
  }

  Color _statusTextColor(String status) {
    switch (status.trim().toLowerCase()) {
      case 'completed':
        return const Color(0xFF2E7D32);
      case 'cancelled':
        return const Color(0xFFC62828);
      default:
        return const Color(0xFF1565C0);
    }
  }

  Widget _buildVisitCard(Map<String, dynamic> visit) {
    final dateRaw = (visit['scheduled_date'] ?? '').toString();
    final notes = (visit['notes'] ?? visit['note'] ?? '').toString().trim();
    final statusRaw = (visit['status'] ?? 'scheduled').toString();
    final status = _formatStatus(statusRaw);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE6EEF8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF3FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.event_available_rounded, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _formatVisitDate(dateRaw),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1C1E21),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  notes.isNotEmpty ? notes : 'No notes added',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: notes.isNotEmpty ? const Color(0xFF4F5B67) : const Color(0xFF90A4AE),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _statusBgColor(statusRaw),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _statusTextColor(statusRaw).withOpacity(0.45)),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _statusTextColor(statusRaw),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F9FC),
      appBar: AppBar(
        toolbarHeight: 72,
        elevation: 0.8,
        shadowColor: Colors.black.withOpacity(0.08),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        titleSpacing: 4,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Valuation Schedule',
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              widget.projectTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _scheduleVisit,
        icon: const Icon(Icons.add),
        label: Text(widget.fabLabel ?? 'Schedule Visit'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF3E0),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Icon(
                            _isOfflineMessage(_error)
                                ? Icons.cloud_off_rounded
                                : Icons.error_outline_rounded,
                            color: _isOfflineMessage(_error) ? Colors.orange : AppColors.error,
                            size: 34,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _isOfflineMessage(_error)
                              ? 'You are offline. Saved valuation dates will appear once internet is back.'
                              : _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _isOfflineMessage(_error) ? const Color(0xFF8D6E63) : AppColors.error,
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : _visits.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEAF3FF),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Icon(
                                Icons.calendar_month_rounded,
                                color: AppColors.primary,
                                size: 34,
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              widget.emptyStateText ?? 'No visits scheduled',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 15,
                                height: 1.4,
                                color: Color(0xFF546E7A),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadVisits,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                        itemCount: _visits.length,
                        itemBuilder: (ctx, i) {
                          final v = _visits[i];
                          return _buildVisitCard(v);
                        },
                      ),
                    ),
    );
  }
}
