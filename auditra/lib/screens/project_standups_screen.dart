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
  String? _currentUsername;

  // Mention autocomplete state
  String? _mentionQuery;

  WebSocketChannel? _channel;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  bool _wsClosed = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentUsername();
    _loadAll();
    _connectWebSocket();
  }

  Future<void> _loadCurrentUsername() async {
    final username = await ApiService.getUsername();
    if (!mounted) return;
    setState(() => _currentUsername = username);
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B1220) : const Color(0xFFF5F7FA),
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.projectTitle ?? 'Daily Standup'),
            Text(
              'Daily Standup',
              style: TextStyle(
                fontSize: 12,
                color: Colors.white.withOpacity(0.85),
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
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
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                          itemCount: _messages.length,
                          itemBuilder: (ctx, i) => _buildMessage(_messages[i]),
                        ),
            ),
            if (_filteredMembers.isNotEmpty && _mentionQuery != null)
              _buildMentionList(),
            _buildTemplateBar(),
            _buildInputBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessage(Map<String, dynamic> msg) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final author = (msg['author_name'] ?? '').toString();
    final authorUsername = (msg['author_username'] ?? '').toString();
    final role = (msg['author_role'] ?? '').toString();
    final body = (msg['body'] ?? '').toString();
    final kind = (msg['kind'] ?? 'free').toString();
    final createdAt = (msg['created_at'] ?? '').toString();
    final isMine = _currentUsername != null && authorUsername == _currentUsername;
    final seenBy = ((msg['seen_by'] is List) ? List<Map<String, dynamic>>.from(msg['seen_by']) : <Map<String, dynamic>>[]);
    final seenByOthers = seenBy.where((u) => (u['username'] ?? '').toString() != authorUsername).toList();
    final kindLabel = {
      'work_to_do': 'Work To Do',
      'work_done': 'Work Done',
    }[kind];
    final kindColor = {
      'work_to_do': Colors.orange,
      'work_done': Colors.green,
    }[kind];

    final bubbleColor = isMine
        ? (isDark ? const Color(0xFF2E4A32) : const Color(0xFFDCF8C6))
        : (isDark ? const Color(0xFF111827) : Colors.white);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isMine) ...[
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primary.withOpacity(0.15),
              child: Text(
                author.isNotEmpty ? author[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
            const SizedBox(width: 8),
          ],
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: bubbleColor,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isMine
                      ? (isDark ? const Color(0xFF3E6B43) : const Color(0xFFB7E3A2))
                      : (isDark ? const Color(0xFF334155) : Colors.grey.shade300),
                ),
                boxShadow: const [
                  BoxShadow(color: Color(0x14000000), blurRadius: 2, offset: Offset(0, 1)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          author,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isMine ? Colors.green.shade800 : AppColors.primary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        _formatTime(createdAt),
                        style: TextStyle(color: Colors.grey[500], fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          role,
                          style: TextStyle(color: Colors.grey[600], fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (kindLabel != null) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: kindColor!.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            kindLabel,
                            style: TextStyle(color: kindColor, fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  _buildMessageBody(body),
                  if (isMine) ...[
                    const SizedBox(height: 6),
                    Text(
                      seenByOthers.isNotEmpty
                          ? 'Seen by: ${seenByOthers.map((u) => (u['name'] ?? u['username'] ?? '').toString()).where((s) => s.isNotEmpty).join(', ')}'
                          : 'Sent',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (isMine) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.primary.withOpacity(0.15),
              child: Text(
                author.isNotEmpty ? author[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(String isoTime) {
    if (isoTime.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoTime).toLocal();
      final hh = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final mm = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$hh:$mm $ampm';
    } catch (_) {
      return '';
    }
  }

  String _formatRole(String role) {
    if (role.isEmpty) return '';
    return role
        .split('_')
        .map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}')
        .join(' ');
  }

  Widget _buildMessageBody(String body) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final words = body.split(RegExp(r'\s+'));
    return RichText(
      text: TextSpan(
        style: TextStyle(
          fontSize: 14,
          height: 1.4,
          color: isDark ? Colors.grey[100] : Colors.black87,
        ),
        children: words.map((word) {
          final isMention = word.startsWith('@');
          return TextSpan(
            text: '$word ',
            style: isMention
                ? const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)
                : null,
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMentionList() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 6),
      constraints: const BoxConstraints(maxHeight: 180),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF111827) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? const Color(0xFF334155) : Colors.grey.shade300),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListView.separated(
        shrinkWrap: true,
        itemCount: _filteredMembers.length,
        separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade200),
        itemBuilder: (ctx, i) {
          final m = _filteredMembers[i];
          final username = (m['username'] ?? '').toString();
          final role = _formatRole((m['role'] ?? '').toString());
          return ListTile(
            dense: true,
            leading: CircleAvatar(
              radius: 15,
              backgroundColor: AppColors.primary.withOpacity(0.12),
              child: Text(
                username.isNotEmpty ? username[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w700),
              ),
            ),
            title: Text(
              '@$username',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 14,
                color: isDark ? Colors.grey[100] : Colors.black87,
              ),
            ),
            subtitle: Text(
              role,
              style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey.shade700),
            ),
            onTap: () => _insertMention(m),
          );
        },
      ),
    );
  }

  Widget _buildTemplateBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Widget floatingKindButton({
      required String label,
      required IconData icon,
      required String value,
      required Color activeColor,
    }) {
      final selected = _kind == value;
      return Material(
        color: Colors.transparent,
        elevation: selected ? 3 : 1.5,
        shadowColor: selected ? activeColor.withOpacity(0.35) : Colors.black26,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => setState(() => _kind = selected ? 'free' : value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? activeColor.withOpacity(0.15)
                  : (isDark ? const Color(0xFF111827) : Colors.white),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? activeColor : (isDark ? const Color(0xFF334155) : Colors.grey.shade300),
                width: selected ? 1.5 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 14, color: selected ? activeColor : Colors.grey.shade700),
                const SizedBox(width: 5),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? activeColor : (isDark ? Colors.grey[100] : Colors.black87),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
      child: Row(
        children: [
          floatingKindButton(
            label: 'Work To Do',
            icon: Icons.assignment_late_outlined,
            value: 'work_to_do',
            activeColor: Colors.orange.shade700,
          ),
          const SizedBox(width: 10),
          floatingKindButton(
            label: 'Work Done',
            icon: Icons.task_alt_rounded,
            value: 'work_done',
            activeColor: Colors.green.shade700,
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Text(
              'Use @ to mention a teammate',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  onChanged: _onTextChanged,
                  maxLines: 4,
                  minLines: 1,
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    filled: true,
                    fillColor: isDark ? const Color(0xFF111827) : Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: AppColors.primary, width: 2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                decoration: BoxDecoration(
                  color: _controller.text.trim().isEmpty ? Colors.grey.shade300 : AppColors.primary,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: _controller.text.trim().isEmpty
                      ? null
                      : [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.35),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                ),
                child: IconButton(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded),
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
