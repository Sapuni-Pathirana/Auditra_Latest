import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class ThemeService extends ChangeNotifier {
  static const _key = 'theme_mode';
  ThemeMode _mode = ThemeMode.system;

  ThemeService() {
    _load();
  }

  ThemeMode get mode => _mode;

  String get preference {
    switch (_mode) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
      default:
        return 'system';
    }
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_key) ?? 'system';
    _mode = _parse(stored);
    notifyListeners();
  }

  /// Persists the chosen theme both locally and on the server so that the
  /// user's preference follows them across devices and the web dashboard
  /// (Feature #16).
  Future<void> setMode(String modeStr, {bool sync = true}) async {
    _mode = _parse(modeStr);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, modeStr);
    notifyListeners();
    if (sync) {
      // Fire and forget; UI should not block on the network.
      try {
        ApiService.updateUserProfile({'theme_preference': modeStr});
      } catch (_) {}
    }
  }

  void toggle() {
    if (_mode == ThemeMode.light) {
      setMode('dark');
    } else if (_mode == ThemeMode.dark) {
      setMode('system');
    } else {
      setMode('light');
    }
  }

  /// Hydrate from a server payload (call after login / profile load).
  Future<void> applyServerPreference(String? serverValue) async {
    if (serverValue == null || serverValue.isEmpty) return;
    await setMode(serverValue, sync: false);
  }

  static ThemeMode _parse(String s) {
    switch (s) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }
}
