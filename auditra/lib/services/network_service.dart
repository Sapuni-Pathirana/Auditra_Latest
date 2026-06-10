import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'api_service.dart';

/// Service for monitoring network connectivity status
class NetworkService {
  static final Connectivity _connectivity = Connectivity();
  static final _controller = StreamController<bool>.broadcast();
  static StreamSubscription<List<ConnectivityResult>>? _subscription;
  static bool _isOnline = true;
  static bool _isInitialized = false;
  
  /// Check if network service is initialized (public getter)
  static bool get isInitialized => _isInitialized;

  /// Initialize network monitoring
  static Future<void> init() async {
    if (_isInitialized) return;

    // Check initial status
    _isOnline = await checkConnectivity();
    
    // Listen to connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen(
      (List<ConnectivityResult> results) async {
        final wasOnline = _isOnline;
        
        // Quick check: if results contain none or is empty, immediately mark as offline
        if (results.isEmpty || results.contains(ConnectivityResult.none)) {
          print('Connectivity change detected: No network (airplane mode?)');
          _isOnline = false;
          if (wasOnline != _isOnline) {
            _controller.add(_isOnline);
          }
          return;
        }
        
        // Otherwise, do full connectivity check
        _isOnline = await checkConnectivity();
        
        // Only emit if status actually changed
        if (wasOnline != _isOnline) {
          print('Network status changed: ${_isOnline ? "Online" : "Offline"}');
          _controller.add(_isOnline);
        }
      },
    );

    _isInitialized = true;
    print('Network service initialized (Online: $_isOnline)');
  }

  /// Check actual internet connectivity (not just WiFi/Data connection)
  static Future<bool> checkConnectivity() async {
    try {
      // First check if device has network interface - this catches airplane mode
      final connectivityResults = await _connectivity.checkConnectivity();
      
      // If no connectivity at all (airplane mode, no WiFi, no mobile data), return false immediately
      if (connectivityResults.isEmpty || connectivityResults.contains(ConnectivityResult.none)) {
        print('No network connectivity detected (airplane mode or no network)');
        return false;
      }

      // Only proceed with HTTP check if we have a network interface
      // Check actual internet access by making a lightweight request
      // Using a reliable endpoint with short timeout
      try {
        final response = await http
            .get(Uri.parse('https://www.google.com'))
            .timeout(const Duration(seconds: 2));
        
        return response.statusCode == 200;
      } catch (e) {
        // If Google fails, try backend API with shorter timeout
        try {
          await http
              .get(Uri.parse('${ApiService.baseUrl}/auth/my-role/'))
              .timeout(const Duration(seconds: 2));
          
          // Even if unauthorized, it means we have connectivity
          return true;
        } catch (e2) {
          // Both failed, no internet connectivity
          print('HTTP connectivity check failed: $e2');
          return false;
        }
      }
    } catch (e) {
      print('Error checking connectivity: $e');
      return false;
    }
  }

  /// Get current online status
  static bool get isOnline => _isOnline;

  /// Stream of network status changes
  static Stream<bool> get networkStatusStream => _controller.stream;

  /// Dispose resources
  static void dispose() {
    _subscription?.cancel();
    _controller.close();
    _isInitialized = false;
  }
}

