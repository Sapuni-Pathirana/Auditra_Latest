import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';

class ErrorReporter {
  static void reportFlutterError(FlutterErrorDetails details) {
    if (kDebugMode) {
      developer.log(
        'Flutter error: ${details.exception}',
        error: details.exception,
        stackTrace: details.stack,
        name: 'ErrorReporter',
      );
    }
  }

  static void reportError(Object error, StackTrace stack) {
    if (kDebugMode) {
      developer.log(
        'Uncaught error: $error',
        error: error,
        stackTrace: stack,
        name: 'ErrorReporter',
      );
    }
    // Future: send to Sentry / Crashlytics
  }
}
