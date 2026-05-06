import 'package:flutter/material.dart';
import '../../../../models/project_model.dart';
import '../../../../theme/app_colors.dart';
import '../../../../widgets/shared_dashboard_widgets.dart';
import '../../visit_scheduling_screen.dart';
import '../utils/field_officer_document_manager.dart';

class ProjectDetailsScreen extends StatefulWidget {
  final Project project;

  const ProjectDetailsScreen({
    super.key,
    required this.project,
  });

  @override
  State<ProjectDetailsScreen> createState() => _ProjectDetailsScreenState();
}

class _ProjectDetailsScreenState extends State<ProjectDetailsScreen> {
  late FieldOfficerDocumentManager _documentManager;

  @override
  void initState() {
    super.initState();
    _documentManager = FieldOfficerDocumentManager(
      context: context,
      setState: setState,
    );
  }

  String _formatPriorityLabel(String priority) {
    if (priority.isEmpty) return 'MEDIUM';
    return priority.toUpperCase();
  }

  Widget _buildModernInfoCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.28 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final project = widget.project;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220.0,
            floating: false,
            pinned: true,
            backgroundColor: const Color(0xFF0D47A1),
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                project.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                ),
              ),
              centerTitle: false,
              titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
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
                      right: -30,
                      top: -30,
                      child: Icon(
                        Icons.business_center_rounded,
                        color: Colors.white.withOpacity(0.1),
                        size: 200,
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(20.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 40),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.white.withOpacity(0.3)),
                              ),
                              child: Text(
                                project.statusDisplay.toUpperCase(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          ],
                        ),
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
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Description
                  if (project.description != null) ...[
                    Text(
                      'Description',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? const Color(0xFF334155) : Colors.grey.shade200),
                      ),
                      child: Text(
                        project.description!,
                        style: TextStyle(
                          color: isDark ? Colors.grey[300] : Colors.grey[700],
                          fontSize: 15,
                          height: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  Text(
                    'Details',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: _buildModernInfoCard(
                      icon: Icons.flag_rounded,
                      label: 'Priority',
                      value: _formatPriorityLabel(project.priority ?? 'medium'),
                      color: DashboardColors.getPriorityColor(
                          project.priority ?? 'medium'),
                    )),
                    const SizedBox(width: 16),
                    Expanded(
                        child: _buildModernInfoCard(
                      icon: Icons.person_rounded,
                      label: 'Coordinator',
                      value: project.coordinatorName ??
                          project.coordinatorUsername,
                      color: Colors.blue,
                    )),
                  ]),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => VisitSchedulingScreen(
                              projectId: project.id,
                              projectTitle: project.title,
                              appBarTitle:
                                  'Valuation schedule – ${project.title}',
                              fabLabel: 'Set valuation date',
                              emptyStateText:
                                  'No valuation date scheduled. Tap the button to choose when you will visit the site.',
                              confirmDialogTitle: 'Confirm valuation date',
                              confirmDialogScheduleLabel: 'Set date',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.event_available_outlined,
                          color: AppColors.primary),
                      label: const Text('Schedule valuation (site visit)'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0D47A1),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: Color(0xFF0D47A1)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Documents Section
                  if (project.documents.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Text(
                          'Documents',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${project.documents.length}',
                            style: TextStyle(
                              color: Colors.blue[700],
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: project.documents
                            .map((doc) => Column(
                                  children: [
                                    ListTile(
                                      contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 16, vertical: 8),
                                      leading: Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE3F2FD),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: const Icon(
                                            Icons.insert_drive_file_rounded,
                                            color: Color(0xFF1976D2)),
                                      ),
                                      title: Text(
                                        doc.name,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 15),
                                      ),
                                      subtitle: Text(
                                        doc.fileSizeFormatted,
                                        style: TextStyle(
                                            fontSize: 13,
                                            color: Colors.grey[600]),
                                      ),
                                      trailing: doc.fileUrl != null
                                          ? FutureBuilder<bool>(
                                              key: ValueKey(
                                                  'doc_${doc.id}_${_documentManager.downloadedDocuments.contains(doc.id)}'),
                                              future: _documentManager
                                                  .isDocumentDownloaded(doc.id),
                                              builder: (context, snapshot) {
                                                final isDownloaded =
                                                    snapshot.data ?? false;
                                                return Material(
                                                  color: Colors.transparent,
                                                  child: InkWell(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            50),
                                                    onTap: () async {
                                                      if (isDownloaded) {
                                                        final filePath =
                                                            await _documentManager
                                                                .getLocalFilePath(
                                                                    doc.id);
                                                        if (filePath != null) {
                                                          await _documentManager
                                                              .viewDownloadedDocument(
                                                                  filePath);
                                                        }
                                                      } else {
                                                        await _documentManager
                                                            .downloadDocument(
                                                                doc);
                                                      }
                                                    },
                                                    child: Container(
                                                      padding:
                                                          const EdgeInsets.all(
                                                              8),
                                                      decoration: BoxDecoration(
                                                        border: Border.all(
                                                            color: Colors.grey
                                                                .shade300),
                                                        shape: BoxShape.circle,
                                                      ),
                                                      child: Icon(
                                                        isDownloaded
                                                            ? Icons
                                                                .visibility_rounded
                                                            : Icons
                                                                .download_rounded,
                                                        size: 20,
                                                        color: Colors.blue[700],
                                                      ),
                                                    ),
                                                  ),
                                                );
                                              },
                                            )
                                          : null,
                                    ),
                                    if (doc != project.documents.last)
                                      Divider(
                                          height: 1,
                                          indent: 70,
                                          color: Colors.grey.shade100),
                                  ],
                                ))
                            .toList(),
                      ),
                    ),
                  ],
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
