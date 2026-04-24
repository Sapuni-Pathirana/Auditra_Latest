import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../theme/app_colors.dart';

/// Feature #10 — Similar item suggestions (internal catalog + external providers).
/// Supports confirm / edit / reject / create new flows.
class ItemSuggestionsWidget extends StatefulWidget {
  final String initialQuery;
  final String category;
  final void Function(Map<String, dynamic> selected)? onConfirm;
  final void Function()? onCreateNew;
  final void Function(Map<String, dynamic> original)? onReject;
  final void Function(Map<String, dynamic> edited)? onEdit;

  const ItemSuggestionsWidget({
    super.key,
    required this.initialQuery,
    required this.category,
    this.onConfirm,
    this.onCreateNew,
    this.onReject,
    this.onEdit,
  });

  @override
  State<ItemSuggestionsWidget> createState() => _ItemSuggestionsWidgetState();
}

class _ItemSuggestionsWidgetState extends State<ItemSuggestionsWidget> {
  List<Map<String, dynamic>> _suggestions = [];
  bool _loading = false;
  String? _error;
  final Set<int> _rejectedKeys = <int>{};
  Timer? _debounce;
  String _lastQuery = '';

  @override
  void initState() {
    super.initState();
    _lastQuery = widget.initialQuery;
    _fetchSuggestions(widget.initialQuery);
  }

  @override
  void didUpdateWidget(covariant ItemSuggestionsWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialQuery != oldWidget.initialQuery ||
        widget.category != oldWidget.category) {
      _lastQuery = widget.initialQuery;
      _debounceFetch(widget.initialQuery);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _debounceFetch(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _fetchSuggestions(query);
    });
  }

  Future<void> _fetchSuggestions(String query) async {
    if (query.trim().length < 2) {
      setState(() {
        _suggestions = [];
        _loading = false;
        _error = null;
      });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/catalog/suggestions/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'query': query, 'category': widget.category}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as List;
        setState(() {
          _suggestions = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      } else {
        setState(() { _error = 'Failed to load suggestions'; _loading = false; });
      }
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _confirmItem(Map<String, dynamic> item) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      await http.post(
        Uri.parse('${ApiService.baseUrl}/catalog/items/confirm/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'title': item['title'],
          'category': item['category'] ?? widget.category,
          'specs': item['specs'] ?? {},
        }),
      );
    } catch (_) {}
    widget.onConfirm?.call(item);
  }

  void _rejectItem(int index, Map<String, dynamic> item) {
    setState(() {
      _rejectedKeys.add(index);
    });
    widget.onReject?.call(item);
  }

  Future<void> _editItem(int index, Map<String, dynamic> item) async {
    final titleController = TextEditingController(text: (item['title'] ?? '').toString());
    final edited = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit item'),
        content: TextField(
          controller: titleController,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Title'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, {
              ...item,
              'title': titleController.text.trim(),
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (edited == null) return;
    // Persist the edited item as a catalog entry and fire callback
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      await http.post(
        Uri.parse('${ApiService.baseUrl}/catalog/items/confirm/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'title': edited['title'],
          'category': edited['category'] ?? widget.category,
          'specs': edited['specs'] ?? {},
        }),
      );
    } catch (_) {}
    widget.onEdit?.call(edited);
  }

  @override
  Widget build(BuildContext context) {
    final visibleSuggestions = <MapEntry<int, Map<String, dynamic>>>[];
    for (var i = 0; i < _suggestions.length; i++) {
      if (_rejectedKeys.contains(i)) continue;
      visibleSuggestions.add(MapEntry(i, _suggestions[i]));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Suggested Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 8),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else if (_error != null)
          Text(_error!, style: const TextStyle(color: AppColors.error))
        else if (visibleSuggestions.isEmpty)
          const Text('No suggestions found', style: TextStyle(color: AppColors.textSecondary))
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: visibleSuggestions.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (ctx, j) {
              final entry = visibleSuggestions[j];
              final i = entry.key;
              final s = entry.value;
              final confidence = ((s['confidence'] as num?)?.toDouble() ?? 0.0) * 100;
              final source = (s['source'] ?? '').toString();
              return ListTile(
                title: Text(s['title'] ?? ''),
                subtitle: Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${s['category'] ?? widget.category} – ${confidence.toStringAsFixed(0)}% match'
                        '${source.isNotEmpty ? ' · $source' : ''}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                trailing: Wrap(
                  spacing: 0,
                  children: [
                    IconButton(
                      tooltip: 'Use',
                      icon: const Icon(Icons.check, color: Colors.green),
                      onPressed: () => _confirmItem(s),
                    ),
                    IconButton(
                      tooltip: 'Edit',
                      icon: const Icon(Icons.edit_outlined, color: Colors.blue),
                      onPressed: () => _editItem(i, s),
                    ),
                    IconButton(
                      tooltip: 'Reject',
                      icon: const Icon(Icons.close, color: Colors.red),
                      onPressed: () => _rejectItem(i, s),
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: widget.onCreateNew,
          icon: const Icon(Icons.add),
          label: const Text('Create new item manually'),
        ),
      ],
    );
  }
}
