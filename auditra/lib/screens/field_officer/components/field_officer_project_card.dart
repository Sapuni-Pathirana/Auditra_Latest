import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../models/project_model.dart';
import '../../../../theme/app_colors.dart';

class FieldOfficerProjectCard extends StatelessWidget {
  final Project project;
  final Function(Project) onViewDetails;
  final Function(Project) onViewReports;
  final Function(Project) onCreateReport;
  final Function(Project) onSubmit;
  final void Function(Project)? onScheduleVisit;

  const FieldOfficerProjectCard({
    super.key,
    required this.project,
    required this.onViewDetails,
    required this.onViewReports,
    required this.onCreateReport,
    required this.onSubmit,
    this.onScheduleVisit,
  });

  static String _formatNextVisitLine(String? iso) {
    if (iso == null || iso.isEmpty) return 'Not set';
    try {
      return DateFormat('MMM d').format(DateTime.parse(iso));
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final priority = project.priority ?? 'medium';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.28 : 0.08),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Gradient Strip
          Container(
            height: 6,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _getStatusGradient(project.status),
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Status and Priority
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildStatusBadge(project.status, project.statusDisplay),
                    _buildPriorityBadge(priority),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                // Title
                Text(
                  project.title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1A1A),
                    letterSpacing: -0.5,
                    height: 1.2,
                  ),
                ),
                
                // Description
                if (project.description != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    project.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ],
                
                const SizedBox(height: 20),
                
                // Info Row
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF5F7FA),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            const CircleAvatar(
                              radius: 12,
                              backgroundColor: Colors.white,
                              child: Icon(Icons.person, size: 14, color: AppColors.primary),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Coordinator',
                                    style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                                  ),
                                  Text(
                                    project.coordinatorName ?? project.coordinatorUsername,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? Colors.white : const Color(0xFF333333),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(width: 1, height: 24, color: Colors.grey[300]),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Valuation visit',
                            style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.event_available, size: 14, color: Colors.grey[500]),
                              const SizedBox(width: 4),
                              Text(
                                _formatNextVisitLine(project.nextScheduledVisit),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.grey[200] : Colors.grey[800],
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // Actions
                Row(
                  children: [
                    Expanded(
                      flex: 1,
                      child: _buildActionButton(
                        icon: Icons.info_outline_rounded,
                        label: 'Details',
                        color: Colors.grey[800]!,
                        backgroundColor: Theme.of(context).cardColor,
                        borderColor: isDark ? const Color(0xFF334155) : Colors.grey[300]!,
                        onTap: () => onViewDetails(project),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 1,
                      child: _buildActionButton(
                        icon: Icons.assessment_outlined,
                        label: 'Valuations',
                        color: const Color(0xFF0D47A1),
                        backgroundColor: const Color(0xFFE3F2FD),
                        borderColor: Colors.transparent,
                        onTap: () => onViewReports(project),
                      ),
                    ),
                  ],
                ),
                if (onScheduleVisit != null) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => onScheduleVisit!(project),
                      icon: const Icon(Icons.event_note_outlined, size: 18),
                      label: const Text('Set valuation date'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0D47A1),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFF1976D2)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
                if (project.status == 'in_progress') ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => onCreateReport(project),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0D47A1),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: Color(0xFF0D47A1)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.note_add_outlined, size: 18),
                      label: const Text(
                        'Create Report',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => onSubmit(project),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D47A1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Submit to Accessor',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward_rounded, size: 18),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required Color backgroundColor,
    required Color borderColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status, String display) {
    Color color;
    Color bg;
    
    switch (status) {
      case 'pending':
        color = const Color(0xFFF57C00);
        bg = const Color(0xFFFFF3E0);
        break;
      case 'in_progress':
        color = const Color(0xFF1976D2);
        bg = const Color(0xFFE3F2FD);
        break;
      case 'completed':
        color = const Color(0xFF388E3C);
        bg = const Color(0xFFE8F5E9);
        break;
      case 'cancelled':
        color = const Color(0xFFD32F2F);
        bg = const Color(0xFFFFEBEE);
        break;
      default:
        color = Colors.grey[700]!;
        bg = Colors.grey[100]!;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            display,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityBadge(String priority) {
    Color color;

    switch (priority.toLowerCase()) {
      case 'high':
        color = const Color(0xFF0D47A1);
        break;
      case 'low':
        color = const Color(0xFF388E3C);
        break;
      case 'medium':
      default:
        color = const Color(0xFFF57C00);
    }

    return Container(
      constraints: const BoxConstraints(maxWidth: 90),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.flag_rounded, size: 14, color: color),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              priority.toUpperCase(),
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Color> _getStatusGradient(String status) {
    switch (status) {
      case 'pending':
        return [const Color(0xFFFFA726), const Color(0xFFFB8C00)];
      case 'in_progress':
        return [const Color(0xFF42A5F5), const Color(0xFF1E88E5)];
      case 'completed':
        return [const Color(0xFF66BB6A), const Color(0xFF43A047)];
      case 'cancelled':
        return [const Color(0xFFEF5350), const Color(0xFFE53935)];
      default:
        return [Colors.grey[400]!, Colors.grey[600]!];
    }
  }
}
