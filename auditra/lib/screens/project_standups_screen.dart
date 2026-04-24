import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;
import '../services/api_service.dart';
import '../theme/app_colors.dart';

/// Feature #1 — Per-project standup chat (work-to-do / work-done templates + @mention).
class ProjectStandupsScreen extends StatefulWidget {
  final int projectId;
  final String? projectTitle;
  const ProjectStandupsScreen({super.key, required this.projectId, this.projectTitle});

  @override
  State<ProjectStandupsScreen> createState() => _ProjectStandupsScreenState();
}

class _ProjectStandupsScreenState extends State<ProjectStandupsScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _members = [];
  bool _loading = true;
  bool _sending = false;
  String _kind = 'free';

  // Mention autocomplete state
  String? _mentionQuery;

  WebSocketChannel? _channel;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  bool _wsClosed = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _connectWebSocket();
  }

  @override
  void dispose() {
    _wsClosed = true;
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    try {
      _channel?.sink.close(ws_status.normalClosure);
    } catch (_) {}
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final msgRes = await ApiService.getStandupMessages(widget.projectId);
    final memRes = await ApiService.getStandupMembers(widget.projectId);
    if (!mounted) return;
    setState(() {
      if (msgRes['success'] == true && msgRes['data'] is List) {
        _messages = List<Map<String, dynamic>>.from(msgRes['data']);
      }
      if (memRes['success'] == true && memRes['data'] is List) {
        _members = List<Map<String, dynamic>>.from(memRes['data']);
      }
      _loading = false;
    });
    _scrollToBottom();
  }

  Future<void> _connectWebSocket() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    if (token == null) return;
    // baseUrl is http://10.0.2.2:8000/api → ws host = 10.0.2.2:8000
    final base = ApiService.baseUrl.replaceFirst(RegExp(r'^http'), 'ws').replaceFirst('/api', '');
    final url = Uri.parse('$base/ws/standups/${widget.projectId}/?token=$token');
    try {
      _channel = WebSocketChannel.connect(url);
      _channel!.stream.listen(
        (event) {
          try {
            final data = jsonDecode(event) as Map<String, dynamic>;
            if (data['type'] == 'standup_message' && data['message'] != null) {
              final msg = Map<String, dynamic>.from(data['message']);
              if (!mounted) return;
              setState(() {
                if (!_messages.any((m) => m['id'] == msg['id'])) {
                  _messages.add(msg);
                }
              });
              _scrollToBottom();
            }
          } catch (_) {}
        },
        onDone: () {
          if (!_wsClosed) {
            _reconnectTimer?.cancel();
            _reconnectTimer = Timer(const Duration(seconds: 3), _connectWebSocket);
          }
        },
        onError: (_) {
          if (!_wsClosed) {
            _reconnectTimer?.cancel();
            _reconnectTimer = Timer(const Duration(seconds: 3), _connectWebSocket);
          }
        },
      );
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        try { _channel?.sink.add(jsonEncode({'action': 'ping'})); } catch (_) {}
      });
    } catch (_) {
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(seconds: 3), _connectWebSocket);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final res = await ApiService.postStandupMessage(widget.projectId, text, kind: _kind);
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final msg = Map<String, dynamic>.from(res['data']);
      setState(() {
        if (!_messages.any((m) => m['id'] == msg['id'])) {
          _messages.add(msg);
        }
        _controller.clear();
        _kind = 'free';
        _sending = false;
        _mentionQuery = null;
      });
      _scrollToBottom();
    } else {
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message']?.toString() ?? 'Failed to send')),
      );
    }
  }

  void _onTextChanged(String value) {
    final match = RegExp(r'@(\w*)$').firstMatch(value);
    setState(() => _mentionQuery = match?.group(1));
  }

  void _insertMention(Map<String, dynamic> member) {
    final name = (member['username'] ?? '').toString();
    final newValue = _controller.text.replaceFirst(RegExp(r'@\w*$'), '@$name ');
    _controller.text = newValue;
    _controller.selection = TextSelection.fromPosition(TextPosition(offset: newValue.length));
    setState(() => _mentionQuery = null);
  }

  List<Map<String, dynamic>> get _filteredMembers {
    if (_mentionQuery == null) return [];
    final q = _mentionQuery!.toLowerCase();
    return _members.where((m) {
      final u = (m['username'] ?? '').toString().toLowerCase();
      final n = ('${m['first_name'] ?? ''} ${m['last_name'] ?? ''}').toLowerCase();
      return q.isEmpty || u.contains(q) || n.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.projectTitle ?? 'Daily Standup'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty
                      ? const Center(
                          child: Text('No messages yet. Start the standup!'),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(12),
                          itemCount: _messages.length,
                          itemBuilder: (ctx, i) => _buildMessage(_messages[i]),
                        ),
            ),
            if (_filteredMembers.isNotEmpty && _mentionQuery != null)
              _buildMentionList(),
            const Divider(height: 1),
            _buildTemplateBar(),
            _buildInputBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessage(Map<String, dynamic> msg) {
    final author = (msg['author_name'] ?? '').toString();
    final role = (msg['author_role'] ?? '').toString();
    final body = (msg['body'] ?? '').toString();
    final kind = (msg['kind'] ?? 'free').toString();
    final kindLabel = {
      'work_to_do': 'Work To Do',
      'work_done': 'Work Done',
    }[kind];
    final kindColor = {
      'work_to_do': Colors.orange,
      'work_done': Colors.green,
    }[kind];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primary.withOpacity(0.15),
            child: Text(
              author.isNotEmpty ? author[0].toUpperCase() : '?',
              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(author, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 6),
                    Text(role, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    if (kindLabel != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: kindColor!.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          kindLabel,
                          style: TextStyle(color: kindColor, fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(body, style: const TextStyle(fontSize: 14, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMentionList() {
    return Container(
      constraints: const BoxConstraints(maxHeight: 160),
      color: Colors.grey[100],
      child: ListView.builder(
        shrinkWrap: true,
        itemCount: _filteredMembers.length,
        itemBuilder: (ctx, i) {
          final m = _filteredMembers[i];
          return ListTile(
            dense: true,
            leading: CircleAvatar(radius: 14, child: Text(((m['username'] ?? '?').toString())[0].toUpperCase(), style: const TextStyle(fontSize: 12))),
            title: Text((m['username'] ?? '').toString()),
            subtitle: Text((m['role'] ?? '').toString()),
            onTap: () => _insertMention(m),
          );
        },
      ),
    );
  }

  Widget _buildTemplateBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          ChoiceChip(
            label: const Text('Work To Do'),
            selected: _kind == 'work_to_do',
            onSelected: (_) => setState(() => _kind = _kind == 'work_to_do' ? 'free' : 'work_to_do'),
            selectedColor: Colors.orange.shade100,
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: const Text('Work Done'),
            selected: _kind == 'work_done',
            onSelected: (_) => setState(() => _kind = _kind == 'work_done' ? 'free' : 'work_done'),
            selectedColor: Colors.green.shade100,
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              onChanged: _onTextChanged,
              maxLines: 4,
              minLines: 1,
              decoration: InputDecoration(
                hintText: 'Type a message. Use @ to mention.',
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: _sending ? null : _send,
            icon: _sending
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send),
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }
}
