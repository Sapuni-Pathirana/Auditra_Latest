import 'package:flutter/material.dart';

/// Centralized color palette for the application.
class AppColors {
  // Core Palette
  static const Color primary = Color(0xFF1565C0);
  static const Color primaryDark = Color(0xFF0D47A1);
  static const Color primaryLight = Color(0xFF42A5F5);
  static const Color secondary = Color(0xFF60A5FA);
  static const Color accent = Color(0xFF3B82F6);

  // Light backgrounds
  static const Color background = Color(0xFFF1F5F9);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color cardInner = Color(0xFFF8FAFC);
  static const Color paper = Color(0xFFFFFFFF);

  // Text
  static const Color text = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  // Status
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFD97706);
  static const Color error = Color(0xFFDC2626);
  static const Color info = Color(0xFF2563EB);

  // UI
  static const Color divider = Color(0xFFE2E8F0);
  static const Color border = Color(0xFFE2E8F0);
  static const Color shadow = Color(0x0F000000);

  static const Color headerText = Color(0xFF0F172A);
  static const Color headerBg = Color(0xFFFFFFFF);
  static const Color sidebarText = Color(0xFF64748B);

  // Feature #8: Priority colors (mirrors web helpers.js)
  static Color priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return const Color(0xFF6A1B9A);
      case 'high':
        return const Color(0xFFd32f2f);
      case 'medium':
        return const Color(0xFFed6c02);
      case 'low':
        return const Color(0xFF2e7d32);
      default:
        return const Color(0xFF64748B);
    }
  }

  static Color priorityBgColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return const Color(0xFFf3e5f5);
      case 'high':
        return const Color(0xFFfdecea);
      case 'medium':
        return const Color(0xFFfff3e0);
      case 'low':
        return const Color(0xFFe8f5e9);
      default:
        return const Color(0xFFf5f5f5);
    }
  }

  // Card Gradients
  static const List<Color> cardGradient = [surface, cardInner];
  static const List<Color> primaryGradient = [primaryLight, primary];
  static const List<Color> primaryDarkGradient = [primary, primaryDark];

  // Legacy
  static const Color darkNavy = Color(0xFF0F172A);
  static const Color strongBlue = Color(0xFF1565C0);
  static const Color blue = Color(0xFF2563EB);
  static const Color lightBlue = Color(0xFF60A5FA);
  static const Color cream = Color(0xFFF8FAFC);
  static const Color yellow = Color(0xFFEAB308);
  static const Color orange = Color(0xFFF97316);
  static const Color orangeRed = Color(0xFFEF4444);
  static const Color red = Color(0xFFDC2626);
  static const Color danger = Color(0xFFDC2626);

  // ---- Themes ----

  static ThemeData get lightTheme => ThemeData(
        colorScheme: const ColorScheme.light(
          primary: primary,
          secondary: secondary,
          tertiary: accent,
          surface: surface,
          error: error,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: text,
          onError: Colors.white,
          outline: border,
        ),
        scaffoldBackgroundColor: background,
        useMaterial3: true,
        fontFamily: 'Inter',
        appBarTheme: const AppBarTheme(
          backgroundColor: headerBg,
          foregroundColor: headerText,
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardThemeData(
          color: surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: divider),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: divider)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: divider)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: primary, width: 2)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
        dividerColor: divider,
        snackBarTheme: const SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
        ),
      );

  static ThemeData get darkTheme => ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: primaryLight,
          secondary: secondary,
          surface: Color(0xFF1E293B),
          error: Color(0xFFEF4444),
          onPrimary: Colors.black,
          onSecondary: Colors.black,
          onSurface: Color(0xFFF1F5F9),
          onError: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        useMaterial3: true,
        fontFamily: 'Inter',
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E293B),
          foregroundColor: Color(0xFFF1F5F9),
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E293B),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF334155)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E293B),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF334155))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: primaryLight, width: 2)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
        dividerColor: const Color(0xFF334155),
        snackBarTheme: const SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          backgroundColor: Color(0xFF334155),
          contentTextStyle: TextStyle(color: Color(0xFFF8FAFC)),
        ),
        listTileTheme: const ListTileThemeData(
          iconColor: Color(0xFFCBD5E1),
          textColor: Color(0xFFF1F5F9),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryLight,
            foregroundColor: Colors.black,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFE2E8F0),
            side: const BorderSide(color: Color(0xFF475569)),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: primaryLight,
          ),
        ),
      );
}
