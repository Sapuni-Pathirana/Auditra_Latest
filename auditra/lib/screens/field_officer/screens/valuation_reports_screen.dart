import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../models/project_model.dart';
import '../../../../models/valuation_model.dart';
import '../../../../services/api_service.dart';
import '../../valuation_form_screen.dart';
import '../../../../services/pdf_service.dart';
import '../utils/field_officer_document_manager.dart';
import '../utils/field_officer_ui_helpers.dart';
import '../../../../theme/app_colors.dart';
import 'package:open_file/open_file.dart';

class ValuationReportsScreen extends StatefulWidget {
  final Project project;
  final VoidCallback? onProjectUpdated;

  const ValuationReportsScreen({
    super.key,
    required this.project,
    this.onProjectUpdated,
  });

  @override
  State<ValuationReportsScreen> createState() => _ValuationReportsScreenState();
}

class _ValuationReportsScreenState extends State<ValuationReportsScreen> {
  late FieldOfficerDocumentManager _documentManager;
  Project? _currentProject;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _currentProject = widget.project;
    _documentManager = FieldOfficerDocumentManager(
      context: context,
      setState: setState,
    );
  }

  Future<void> _refreshProject() async {
    setState(() => _isLoading = true);
    try {
      final result = await ApiService.getProject(widget.project.id);
      if (result['success']) {
        setState(() {
          _currentProject = Project.fromJson(result['data']);
        });
        widget.onProjectUpdated?.call();
      }
    } catch (e) {
      print('Error refreshing project: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _deleteValuation(Valuation valuation) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Report'),
        content: Text(
          'Are you sure you want to delete this ${valuation.categoryDisplay} report? '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);

    try {
      final result = await ApiService.deleteValuation(valuation.id);

      if (result['success']) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Report deleted successfully'),
              backgroundColor: Colors.green,
            ),
          );
          _refreshProject();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Failed to delete report'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Use current project data or fallback to initial widget data
    final project = _currentProject ?? widget.project;
    final valuations = project.valuations;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverAppBar(
              expandedHeight: 140.0,
              floating: false,
              pinned: true,
              backgroundColor: const Color(0xFF0D47A1),
              elevation: 0,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
                title: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    const Text(
                      'Valuation Reports',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                      ),
                    ),
                    Text(
                      project.title,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 11,
                        fontWeight: FontWeight.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF0D47A1), Color(0xFF1976D2)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Stack(
                    children: [
                      Positioned(
                        right: -20,
                        top: -20,
                        child: Icon(
                          Icons.assignment_rounded,
                          color: Colors.white.withOpacity(0.1),
                          size: 150,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                onPressed: () => Navigator.of(context).pop(),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  onPressed: _refreshProject,
                  tooltip: 'Refresh',
                ),
              ],
            ),
          ];
        },
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : valuations.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.assignment_outlined,
                            size: 64, color: Colors.grey[400]),
                        const SizedBox(height: 16),
                        Text(
                          'No valuation reports yet',
                          style: TextStyle(
                            fontSize: 18,
                            color: isDark ? Colors.grey[300] : Colors.grey[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Tap the + button to create one',
                          style: TextStyle(
                            fontSize: 14,
                            color: isDark ? Colors.grey[400] : Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 80),
                    itemCount: valuations.length,
                    itemBuilder: (context, index) {
                      final valuation = valuations[index];
                      return _buildReportCard(valuation, project);
                    },
                  ),
      ),
      floatingActionButton: project.status == 'in_progress'
          ? FloatingActionButton.extended(
              onPressed: () async {
                final result = await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ValuationFormScreen(project: project),
                  ),
                );
                if (result == true) {
                  _refreshProject();
                }
              },
              backgroundColor: const Color(0xFF0D47A1),
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('New Report', style: TextStyle(color: Colors.white)),
            )
          : null,
    );
  }

  Widget _buildReportCard(Valuation valuation, Project project) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor =
        FieldOfficerUiHelpers.getValuationStatusColor(valuation.status);
    final isDraft = valuation.status == 'draft';
    final isRejected = valuation.status == 'rejected';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.26 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: isRejected ? Border.all(color: Colors.red.shade200) : null,
      ),
      child: Column(
        children: [
          // Header with category and status
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.05),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
              border: Border(
                bottom: BorderSide(color: statusColor.withOpacity(0.1)),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0B1220) : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: statusColor.withOpacity(0.3)),
                  ),
                  child: Icon(
                    _getCategoryIcon(valuation.category),
                    size: 16,
                    color: statusColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    valuation.categoryDisplay,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    valuation.statusDisplay.toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5),
                  ),
                ),
              ],
            ),
          ),
          
          if (isRejected && valuation.rejectionReason != null && valuation.rejectionReason!.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.red.shade50,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 16, color: Colors.red.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Reason: ${valuation.rejectionReason}',
                      style: TextStyle(
                        color: Colors.red.shade900,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Estimated Value',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'LKR ${NumberFormat('#,##0.00').format(valuation.estimatedValue ?? 0)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Date',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateFormat('MMM dd, yyyy')
                                .format(valuation.createdAt),
                            style: TextStyle(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                              color: isDark ? Colors.grey[200] : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (valuation.description != null &&
                    valuation.description!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    valuation.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? Colors.grey[300] : Colors.grey[700],
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    // View Report PDF (if submitted/approved)
                    if (valuation.finalReportUrl != null)
                      IconButton(
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        color: Colors.red[700],
                        tooltip: 'View PDF Report',
                        onPressed: () {
                          // TODO: View existing PDF logic
                          // Use url_launcher or PDF viewer
                        },
                      )
                    else 
                      // Generate Review PDF for any status
                      IconButton(
                        icon: const Icon(Icons.picture_as_pdf),
                        color: Colors.red[700],
                        tooltip: 'Generate PDF Preview',
                        onPressed: () async {
                          // Generate PDF preview
                          try {
                            final file = await PdfService.generateValuationReport(
                              valuation: valuation,
                              project: project,
                            );
                            await OpenFile.open(file.path);
                          } catch (e) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Error generating PDF: $e')),
                            );
                          }
                        },
                      ),

                    // Edit Button (if allowed)
                    if (FieldOfficerUiHelpers.canEditValuation(valuation))
                      IconButton(
                        icon: const Icon(Icons.edit_outlined),
                        color: Colors.blue[700],
                        tooltip: 'Edit Report',
                        onPressed: () async {
                          final result = await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ValuationFormScreen(
                                project: project,
                                existingValuation: valuation,
                              ),
                            ),
                          );
                          if (result == true) {
                            _refreshProject();
                          }
                        },
                      ),
                      
                    // Submit Button (Draft or Rejected)
                    if (isDraft || isRejected)
                       IconButton(
                        icon: const Icon(Icons.send_rounded),
                        color: Colors.green[700],
                        tooltip: 'Submit Report',
                        onPressed: () async {
                           // Navigate to edit/submit form directly
                           final result = await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ValuationFormScreen(
                                project: project,
                                existingValuation: valuation,
                              ),
                            ),
                          );
                          if (result == true) {
                            _refreshProject();
                          }
                        },
                      ),

                    // Delete Button (if allowed)
                    if (FieldOfficerUiHelpers.canDeleteValuation(valuation))
                      IconButton(
                        icon: const Icon(Icons.delete_outline),
                        color: Colors.grey[600],
                        tooltip: 'Delete Report',
                        onPressed: () => _deleteValuation(valuation),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'land':
        return Icons.landscape;
      case 'building':
        return Icons.location_city;
      case 'vehicle':
        return Icons.directions_car;
      default:
        return Icons.category;
    }
  }
}
