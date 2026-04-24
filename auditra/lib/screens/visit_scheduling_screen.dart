import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
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
    _loadVisits();
  }

  Future<void> _loadVisits() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiService.getProjectVisits(widget.projectId);
      if (res['success'] == true) {
        final raw = res['data'];
        final data = raw is List ? raw : <dynamic>[];
        setState(() {
          _visits = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      } else {
        setState(() {
          _error = (res['message'] ?? 'Failed to load valuation dates').toString();
          _loading = false;
        });
      }
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.appBarTitle ?? 'Visits – ${widget.projectTitle}',
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
              ? Center(child: Text(_error!))
              : _visits.isEmpty
                  ? Center(
                      child: Text(widget.emptyStateText ?? 'No visits scheduled'),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadVisits,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _visits.length,
                        itemBuilder: (ctx, i) {
                          final v = _visits[i];
                          final date = v['scheduled_date'] ?? '';
                          final status = v['status'] ?? 'scheduled';
                          return Card(
                            child: ListTile(
                              leading: const Icon(Icons.calendar_today, color: AppColors.primary),
                              title: Text(date),
                              subtitle: Text(v['notes'] ?? ''),
                              trailing: Chip(
                                label: Text(status),
                                backgroundColor: status == 'completed'
                                    ? AppColors.success.withAlpha(30)
                                    : AppColors.primary.withAlpha(20),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
