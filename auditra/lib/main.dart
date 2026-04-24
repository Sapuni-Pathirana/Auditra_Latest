import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:provider/provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';
import 'services/sync_engine.dart';
import 'services/theme_service.dart';
import 'services/error_reporter.dart';
import 'services/realtime_service.dart';
import 'services/push_service.dart';
import 'theme/app_colors.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Hive initialisation
  await Hive.initFlutter();
  await SyncEngine.init();

  // Global error handler
  FlutterError.onError = (details) {
    ErrorReporter.reportFlutterError(details);
  };

  runZonedGuarded(() {
    HttpOverrides.global = MyHttpOverrides();
    final themeService = ThemeService();

    runApp(
      ChangeNotifierProvider.value(
        value: themeService,
        child: const MyApp(),
      ),
    );
  }, (error, stack) {
    ErrorReporter.reportError(error, stack);
  });
}

class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeService = Provider.of<ThemeService>(context);
    return MaterialApp(
      title: 'Auditra',
      debugShowCheckedModeBanner: false,
      theme: AppColors.lightTheme,
      darkTheme: AppColors.darkTheme,
      themeMode: themeService.mode,
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    await Future.delayed(const Duration(seconds: 1));
    final isLoggedIn = await ApiService.isLoggedIn();
    if (!mounted) return;

    if (isLoggedIn) {
      // Feature #3 (C1): initialise push + real-time channels once logged in.
      try {
        await PushService.init();
      } catch (_) {}
      try {
        await RealTimeService.instance.connect('/ws/notifications/');
        RealTimeService.instance.addHandler((msg) {
          final title = (msg['title'] ?? msg['type'] ?? 'Notification').toString();
          final body = (msg['message'] ?? msg['body'] ?? '').toString();
          PushService.showNotification(
            title: title,
            body: body,
            payload: msg['action_url']?.toString(),
          );
        });
      } catch (_) {}

      final roleResult = await ApiService.getMyRole();
      if (!mounted) return;

      // If both access and refresh tokens are expired, force re-login
      if (roleResult['success'] == false) {
        final msg = roleResult['message'] ?? '';
        final isAuthError = msg.contains('expired') ||
            msg.contains('login') ||
            msg.contains('authenticated') ||
            msg.contains('Session');
        if (isAuthError) {
          await ApiService.logout();
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          );
          return;
        }
      }

      final role = await ApiService.getUserRole();
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => HomeScreen(userRole: role ?? 'unassigned'),
        ),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primaryLight, AppColors.primaryDark],
          ),
        ),
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.verified_user, size: 100, color: Colors.white),
              SizedBox(height: 24),
              Text('Auditra', style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Colors.white)),
              SizedBox(height: 16),
              CircularProgressIndicator(color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
