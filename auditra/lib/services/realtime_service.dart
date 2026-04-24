import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef MessageHandler = void Function(Map<String, dynamic> message);

/// Manages a persistent WebSocket connection to the Django Channels backend.
/// Features:
///   - Auto-reconnect with exponential back-off
///   - JWT auth via query parameter
///   - Subscribe/unsubscribe mechanism per-path
class RealTimeService {
  static RealTimeService? _instance;
  static RealTimeService get instance => _instance ??= RealTimeService._();

  RealTimeService._();

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  bool _disposed = false;
  bool _connected = false;

  // Back-off settings
  int _reconnectDelaySeconds = 1;
  static const int _maxReconnectDelay = 60;
  Timer? _reconnectTimer;

  // Active path and handlers
  String? _activePath;
  final List<MessageHandler> _handlers = [];

  // ---- Public API ----

  bool get isConnected => _connected;

  /// Connect to a WebSocket path (e.g. /ws/notifications/).
  Future<void> connect(String path) async {
    if (_connected && _activePath == path) return;
    await disconnect();
    _activePath = path;
    await _doConnect();
  }

  /// Add a handler for incoming messages on the current path.
  void addHandler(MessageHandler handler) {
    _handlers.add(handler);
  }

  void removeHandler(MessageHandler handler) {
    _handlers.remove(handler);
  }

  Future<void> disconnect() async {
    _reconnectTimer?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    _connected = false;
    _channel = null;
  }

  void dispose() {
    _disposed = true;
    disconnect();
  }

  // ---- Internals ----

  Future<void> _doConnect() async {
    if (_disposed || _activePath == null) return;

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    if (token == null) return;

    // Replace http(s) with ws(s) and append JWT query param
    // baseUrl example: http://10.0.2.2:8000/api
    const rawBase = String.fromEnvironment('WS_BASE', defaultValue: 'ws://10.0.2.2:8000');
    final wsUrl = '$rawBase$_activePath?token=$token';

    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _connected = true;
      _reconnectDelaySeconds = 1;

      _subscription = _channel!.stream.listen(
        (raw) {
          try {
            final msg = jsonDecode(raw as String) as Map<String, dynamic>;
            for (final h in List<MessageHandler>.from(_handlers)) {
              h(msg);
            }
          } catch (_) {}
        },
        onDone: () {
          _connected = false;
          _scheduleReconnect();
        },
        onError: (_) {
          _connected = false;
          _scheduleReconnect();
        },
      );
    } catch (_) {
      _connected = false;
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: _reconnectDelaySeconds), () {
      _reconnectDelaySeconds = (_reconnectDelaySeconds * 2).clamp(1, _maxReconnectDelay);
      _doConnect();
    });
  }
}
