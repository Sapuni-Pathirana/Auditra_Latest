import 'dart:convert';
import 'dart:io';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

/// Manages local notifications display.
/// FCM token registration requires the `firebase_messaging` package which
/// needs google-services.json configuration — stub kept here for wiring.
class PushService {
  static final _localNotifications = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static const _androidChannel = AndroidNotificationChannel(
    'auditra_default',
    'Auditra Notifications',
    description: 'Default notification channel for Auditra',
    importance: Importance.high,
  );

  static Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );

    // Create the Android notification channel
    if (Platform.isAndroid) {
      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(_androidChannel);
    }

    _initialized = true;
  }

  /// Show a local push notification.
  static Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
    int id = 0,
  }) async {
    await init();
    const androidDetails = AndroidNotificationDetails(
      'auditra_default',
      'Auditra Notifications',
      channelDescription: 'Default notification channel',
      importance: Importance.high,
      priority: Priority.high,
    );
    const iosDetails = DarwinNotificationDetails();
    await _localNotifications.show(
      id,
      title,
      body,
      const NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: payload,
    );
  }

  /// Register device token with backend (called after FCM setup).
  static Future<void> registerToken(String token, String platform) async {
    final prefs = await SharedPreferences.getInstance();
    final accessToken = prefs.getString('access_token');
    if (accessToken == null) return;

    const baseUrl = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8000/api');
    await http.post(
      Uri.parse('$baseUrl/notifications/device-tokens/'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode({'token': token, 'platform': platform}),
    );
  }
}
