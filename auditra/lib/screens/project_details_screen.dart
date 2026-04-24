import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/project_model.dart';
import '../models/valuation_model.dart';
import '../services/pdf_service.dart';
import '../services/api_service.dart';
import 'project_standups_screen.dart';
import 'visit_scheduling_screen.dart';

class ProjectDetailsScreen extends StatefulWidget {
  final Project project;

  const ProjectDetailsScreen({Key? key, required this.project}) : super(key: key);

  @override
  State<ProjectDetailsScreen> createState() => _ProjectDetailsScreenState();
}

class _ProjectDetailsScreenState extends State<ProjectDetailsScreen> {
  late Project _project;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _project = widget.project;
    _refreshProjectDetails();
  }

  Future<void> _refreshProjectDetails() async {
    setState(() => _isLoading = true);
    final result = await ApiService.getProject(_project.id);
    if (result['success'] && result['data'] != null) {
      if (mounted) {
        setState(() {
          _project = Project.fromJson(result['data']);
        });
      }
    }
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFDAF6EF), // Matching Create Project screen
      body: Column(
        children: [
          // Glassmorphic Header
          _buildHeader(context),
          
          // Main Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshProjectDetails,
              color: const Color(0xFF4CAF50),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Project Title & Status Card
                    _buildProjectHeaderCard(),
                    const SizedBox(height: 20),
                    
                    // Project Details Card
                    _buildSectionCard(
                      title: 'Project Information',
                      icon: Icons.info_outline,
                      child: Column(
                        children: [
                          if (_project.description != null) ...[
                            _buildInfoRow('Description', _project.description!),
                            const SizedBox(height: 16),
                          ],
                          _buildInfoRow('Priority', _getPriorityDisplay()),
                          const SizedBox(height: 16),
                          _buildInfoRow('Coordinator', _project.coordinatorName ?? _project.coordinatorUsername),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    
                    // Timeline Card
                    if (_project.startDate != null || _project.endDate != null)
                      _buildSectionCard(
                        title: 'Timeline',
                        icon: Icons.calendar_today_outlined,
                        child: Row(
                          children: [
                            if (_project.startDate != null)
                              Expanded(
                                child: _buildDateDisplay('Start Date', _project.startDate!),
                              ),
                            if (_project.startDate != null && _project.endDate != null)
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Icon(Icons.arrow_forward, color: Colors.grey[400], size: 20),
                              ),
                            if (_project.endDate != null)
                              Expanded(
                                child: _buildDateDisplay('End Date', _project.endDate!),
                              ),
                          ],
                        ),
                      ),
                    if (_project.startDate != null || _project.endDate != null)
                      const SizedBox(height: 20),
                    
                    // Team Members Card
                    _buildSectionCard(
                      title: 'Team Members',
                      icon: Icons.people_outline,
                      child: Column(
                        children: [
                          _buildTeamMember(
                            'Field Officer',
                            _project.assignedFieldOfficerName ?? 'Not assigned',
                            Icons.engineering_outlined,
                          ),
                          const SizedBox(height: 16),
                          _buildTeamMember(
                            'Client',
                            _project.assignedClientName ?? 'Not assigned',
                            Icons.person_outline,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    
                    // Documents Card
                    if (_project.documents.isNotEmpty)
                      _buildSectionCard(
                        title: 'Documents',
                        icon: Icons.folder_outlined,
                        child: Column(
                          children: _project.documents.asMap().entries.map((entry) {
                            final index = entry.key;
                            final doc = entry.value;
                            return Column(
                              children: [
                                if (index > 0) const SizedBox(height: 12),
                                _buildDocumentItem(doc),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    if (_project.documents.isNotEmpty)
                      const SizedBox(height: 20),
                    
                    // Valuations/Reports Card
                    if (_project.valuations.isNotEmpty)
                      _buildSectionCard(
                        title: 'Valuation Reports',
                        icon: Icons.assessment_outlined,
                        child: Column(
                          children: _project.valuations.asMap().entries.map((entry) {
                            final index = entry.key;
                            final valuation = entry.value;
                            return Column(
                              children: [
                                if (index > 0) const SizedBox(height: 16),
                                _buildValuationItem(valuation),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    if (_project.valuations.isEmpty)
                      _buildEmptyState(),
                    
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 8,
            bottom: 20,
            left: 20,
            right: 20,
          ),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.1),
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withOpacity(0.1),
                width: 1.5,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
                color: const Color(0xFF1F2937),
                iconSize: 24,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Text(
                  'Project Details',
                  style: TextStyle(
                    fontFamily: 'Etna Sans Serif',
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1F2937),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Standups',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ProjectStandupsScreen(
                        projectId: _project.id,
                        projectTitle: _project.title,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.forum_outlined),
                color: const Color(0xFF1F2937),
              ),
              IconButton(
                tooltip: 'Schedule Visit',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => VisitSchedulingScreen(
                        projectId: _project.id,
                        projectTitle: _project.title,
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.event_available_outlined),
                color: const Color(0xFF1F2937),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProjectHeaderCard() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF4CAF50).withOpacity(0.1),
            const Color(0xFF4CAF50).withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF4CAF50).withOpacity(0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4CAF50).withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4CAF50).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.folder_open,
                        color: Color(0xFF4CAF50),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _project.title,
                            style: const TextStyle(
                              fontFamily: 'Etna Sans Serif',
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1F2937),
                            ),
                          ),
                          const SizedBox(height: 8),
                          _buildStatusBadge(),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    Color color;
    IconData icon;
    switch (_project.status.toLowerCase()) {
      case 'pending':
        color = Colors.orange;
        icon = Icons.schedule;
        break;
      case 'in_progress':
        color = Colors.blue;
        icon = Icons.play_circle_outline;
        break;
      case 'completed':
        color = const Color(0xFF84BCDA);
        icon = Icons.check_circle_outline;
        break;
      case 'cancelled':
        color = Colors.red;
        icon = Icons.cancel_outlined;
        break;
      default:
        color = Colors.grey;
        icon = Icons.help_outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 6),
          Text(
            _project.statusDisplay,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.white.withOpacity(0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4CAF50).withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4CAF50).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: const Color(0xFF4CAF50), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1F2937),
                        fontFamily: 'Etna Sans Serif',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF1F2937),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateDisplay(String label, DateTime date) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.calendar_today, size: 16, color: const Color(0xFF4CAF50)),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            DateFormat('MMM dd, yyyy').format(date),
            style: const TextStyle(
              fontSize: 15,
              color: Color(0xFF1F2937),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeamMember(String role, String name, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF4CAF50).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF4CAF50), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  role,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF1F2937),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentItem(dynamic doc) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.insert_drive_file_outlined, color: Colors.blue, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doc.name,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF1F2937),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  doc.fileSizeFormatted,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _deleteDocument(doc.id),
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            iconSize: 20,
          ),
        ],
      ),
    );
  }

  Widget _buildValuationItem(Valuation valuation) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  valuation.categoryDisplay,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1F2937),
                  ),
                ),
              ),
              _buildValuationStatusBadge(valuation.status, valuation.statusDisplay),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
              const SizedBox(width: 6),
              Text(
                'Created on ${DateFormat('MMM dd, yyyy').format(valuation.createdAt)}',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _generatePdfReport(valuation),
              icon: const Icon(Icons.download_rounded, size: 20),
              label: const Text(
                'Download Report',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4CAF50),
                foregroundColor: Colors.white,
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildValuationStatusBadge(String status, String display) {
    Color color;
    switch (status.toLowerCase()) {
      case 'pending':
        color = Colors.orange;
        break;
      case 'in_progress':
        color = Colors.blue;
        break;
      case 'completed':
        color = const Color(0xFF84BCDA);
        break;
      default:
        color = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        display,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.white.withOpacity(0.5),
          width: 1.5,
        ),
      ),
      child: Column(
        children: [
          Icon(Icons.assessment_outlined, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No Valuation Reports',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Reports will appear here once created',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  String _getPriorityDisplay() {
    final priority = _project.priority ?? 'medium';
    final icons = {
      'high': '🔵',
      'medium': '🟡',
      'low': '🟢',
    };
    return '${icons[priority.toLowerCase()] ?? ''} ${priority.toUpperCase()}';
  }

  Future<void> _deleteDocument(int docId) async {
    final result = await ApiService.deleteProjectDocument(docId);
    if (result['success']) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Document deleted successfully'),
            backgroundColor: Color(0xFF4CAF50),
          ),
        );
      }
      _refreshProjectDetails();
    }
  }

  Future<void> _generatePdfReport(Valuation valuation) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF4CAF50)),
        ),
      ),
    );

    try {
      final file = await PdfService.generateValuationReport(
        valuation: valuation,
        project: _project,
      );
      if (mounted) Navigator.pop(context);
      await PdfService.saveAndOpenPdf(file);
    } catch (e) {
      if (mounted) Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error generating report: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
