
import 'package:flutter/material.dart';
import '../../../models/project_model.dart';
import '../components/offline_queue_section.dart';
import '../components/field_officer_project_card.dart';
import '../styles/field_officer_styles.dart';

class FieldOfficerProjectsTab extends StatefulWidget {
  final List<Project> projects;
  final bool isLoading;
  final Future<void> Function() onRefresh;
  final Function(Project) onViewDetails;
  final Function(Project) onViewReports;
  final Function(Project) onSubmit;

  const FieldOfficerProjectsTab({
    super.key,
    required this.projects,
    required this.isLoading,
    required this.onRefresh,
    required this.onViewDetails,
    required this.onViewReports,
    required this.onSubmit,
  });

  @override
  State<FieldOfficerProjectsTab> createState() => _FieldOfficerProjectsTabState();
}

class _FieldOfficerProjectsTabState extends State<FieldOfficerProjectsTab> {
  final TextEditingController _searchController = TextEditingController();
  String _sortOption = 'date_asc'; // 'date_asc', 'date_desc', 'title_asc', 'title_desc', 'priority'

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Project> _filterAndSortProjects(List<Project> projects) {
    // Get search query
    final searchQuery = _searchController.text.toLowerCase().trim();
    
    // Filter by search query
    var filtered = projects.where((p) {
      if (searchQuery.isEmpty) return true;
      return p.title.toLowerCase().contains(searchQuery) ||
          (p.description?.toLowerCase().contains(searchQuery) ?? false);
    }).toList();
    
    // Sort projects
    switch (_sortOption) {
      case 'date_desc':
        filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        break;
      case 'title_asc':
        filtered.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
        break;
      case 'title_desc':
        filtered.sort((a, b) => b.title.toLowerCase().compareTo(a.title.toLowerCase()));
        break;
      case 'priority':
        final priorityOrder = {'high': 3, 'medium': 2, 'low': 1};
        filtered.sort((a, b) {
          final aPriority = priorityOrder[a.priority?.toLowerCase() ?? 'medium'] ?? 2;
          final bPriority = priorityOrder[b.priority?.toLowerCase() ?? 'medium'] ?? 2;
          if (aPriority != bPriority) return bPriority.compareTo(aPriority);
          return a.createdAt.compareTo(b.createdAt);
        });
        break;
      case 'date_asc':
      default:
        filtered.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        break;
    }
    
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filteredProjects = _filterAndSortProjects(widget.projects);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: FieldOfficerStyles.primaryBlue,
      child: widget.isLoading && widget.projects.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : widget.projects.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.folder_open, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'No projects assigned',
                        style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Projects assigned to you will appear here',
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    const OfflineQueueSection(),
                    // Search and Sort Bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      color: Theme.of(context).cardColor,
                      child: Row(
                        children: [
                          // Search field
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              decoration: InputDecoration(
                                hintText: 'Search projects...',
                                prefixIcon: const Icon(Icons.search, size: 20),
                                suffixIcon: _searchController.text.isNotEmpty
                                    ? IconButton(
                                        icon: const Icon(Icons.clear, size: 18),
                                        onPressed: () {
                                          _searchController.clear();
                                        },
                                      )
                                    : null,
                                filled: true,
                                fillColor: isDark ? const Color(0xFF1E293B) : Colors.grey[100],
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide.none,
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                isDense: true,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Sort dropdown
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF1E293B)
                                  : FieldOfficerStyles.lightBlue.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isDark
                                    ? const Color(0xFF334155)
                                    : FieldOfficerStyles.lightBlue.withOpacity(0.5),
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.sort, size: 20, color: FieldOfficerStyles.primaryBlue),
                                const SizedBox(width: 6),
                                DropdownButton<String>(
                                  value: _sortOption,
                                  underline: const SizedBox(),
                                  icon: Icon(Icons.arrow_drop_down, size: 22, color: FieldOfficerStyles.primaryBlue),
                                  isDense: false,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.blue[900],
                                  ),
                                  items: const [
                                    DropdownMenuItem(
                                      value: 'date_asc',
                                      child: Text('Date ↑', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'date_desc',
                                      child: Text('Date ↓', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'title_asc',
                                      child: Text('Title A-Z', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'title_desc',
                                      child: Text('Title Z-A', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'priority',
                                      child: Text('Priority', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                                    ),
                                  ],
                                  onChanged: (value) {
                                    setState(() {
                                      _sortOption = value!;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: filteredProjects.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
                                  const SizedBox(height: 16),
                                  Text(
                                    'No projects found',
                                    style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Try adjusting your search criteria',
                                    style: TextStyle(color: Colors.grey[500]),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: filteredProjects.length,
                              itemBuilder: (context, index) {
                                final project = filteredProjects[index];
                                return FieldOfficerProjectCard(
                                  project: project,
                                  onViewDetails: widget.onViewDetails,
                                  onViewReports: widget.onViewReports,
                                  onCreateReport: (_) {},
                                  onSubmit: widget.onSubmit,
                                  onScheduleVisit: null,
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}
