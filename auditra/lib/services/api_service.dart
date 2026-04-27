import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'network_service.dart';
import 'offline_db_service.dart';
import 'offline_storage_service.dart';

class ApiService {
  // Change this to your computer's IP address when testing on physical device
  // For emulator, use 10.0.2.2 (Android) or localhost (iOS)
  // For physical device, use your computer's IP address (e.g., 'http://192.168.1.100:8000/api')
  // For Chrome/web, use localhost
  static const String baseUrl = 'http://10.0.2.2:8000/api'; // Using 10.0.2.2 for Android emulator

  // Register new user
  static Future<Map<String, dynamic>> register({
    required String username,
    required String email,
    required String password,
    String? firstName,
    String? lastName,
  }) async {
    try {
      print('🔵 Registering user: $username');
      print('🔵 API URL: $baseUrl/auth/register/');
      
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'email': email,
          'password': password,
          'password2': password,
          'first_name': firstName ?? '',
          'last_name': lastName ?? '',
        }),
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw Exception('Request timeout. Please check your connection.');
        },
      );
      
      print('🔵 Response status: ${response.statusCode}');
      print('🔵 Response body: ${response.body}');

      // Parse JSON response
      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        print('❌ Failed to parse JSON: $e');
        return {'success': false, 'message': 'Invalid response from server'};
      }

      if (response.statusCode == 201) {
        // Save tokens
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', data['access'] ?? '');
        await prefs.setString('refresh_token', data['refresh'] ?? '');
        if (data['user'] != null) {
          await prefs.setString('user_id', data['user']['id'].toString());
          await prefs.setString('username', data['user']['username'] ?? '');
        }
        
        return {'success': true, 'data': data};
      } else {
        // Extract error message from response
        String errorMessage = 'Registration failed';
        
        // Handle field-specific errors
        if (data.containsKey('username')) {
          if (data['username'] is List) {
            errorMessage = 'Username: ${(data['username'] as List).first}';
          } else {
            errorMessage = 'Username: ${data['username']}';
          }
        } else if (data.containsKey('email')) {
          if (data['email'] is List) {
            errorMessage = 'Email: ${(data['email'] as List).first}';
          } else {
            errorMessage = 'Email: ${data['email']}';
          }
        } else if (data.containsKey('password')) {
          if (data['password'] is List) {
            errorMessage = 'Password: ${(data['password'] as List).first}';
          } else {
            errorMessage = 'Password: ${data['password']}';
          }
        } else if (data.containsKey('error')) {
          errorMessage = data['error'].toString();
        } else if (data.containsKey('message')) {
          errorMessage = data['message'].toString();
        } else if (data.containsKey('non_field_errors')) {
          if (data['non_field_errors'] is List) {
            errorMessage = (data['non_field_errors'] as List).first.toString();
          } else {
            errorMessage = data['non_field_errors'].toString();
          }
        } else {
          // Get first error from any field
          for (var key in data.keys) {
            if (data[key] is List && (data[key] as List).isNotEmpty) {
              errorMessage = '$key: ${(data[key] as List).first}';
              break;
            } else if (data[key] is String) {
              errorMessage = '$key: ${data[key]}';
              break;
            }
          }
        }
        
        print('❌ Registration error: $errorMessage');
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      // Handle different types of errors
      String errorMessage = 'Connection error';
      if (e.toString().contains('Failed host lookup') || e.toString().contains('Network is unreachable')) {
        errorMessage = 'Cannot connect to server. Make sure the backend is running at http://10.0.2.2:8000';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Connection refused. Is the backend server running?';
      } else {
        errorMessage = 'Error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMessage};
    }
  }

  // Login user
  static Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
        }),
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML. Endpoint /api/auth/login/ may not exist or backend has an error (404/500).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response. Server may have returned an error page.'};
      }

      if (response.statusCode == 200) {
        // Save tokens
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', data['access']);
        await prefs.setString('refresh_token', data['refresh']);
        await prefs.setString('user_id', data['user']['id'].toString());
        await prefs.setString('username', data['user']['username']);
        await prefs.setBool('password_change_required', data['password_change_required'] == true);
        if (data['theme_preference'] != null) {
          await prefs.setString('theme_preference', data['theme_preference']);
        }

        return {
          'success': true,
          'data': data,
          'password_change_required': data['password_change_required'] == true,
        };
      } else {
        return {'success': false, 'message': data['error'] ?? 'Login failed'};
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if /api/auth/login/ endpoint exists and backend is running.';
      } else if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else {
        errorMsg = 'Connection error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get user profile
  static Future<Map<String, dynamic>> getProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/profile/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        String errorMsg = 'Failed to load profile (Status: ${response.statusCode})';
        try {
          final errorData = jsonDecode(response.body);
          if (errorData is Map && errorData.containsKey('message')) {
            errorMsg = errorData['message'];
          }
        } catch (_) {}
        return {'success': false, 'message': errorMsg};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if the API endpoint exists and backend is running correctly.';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Refresh access token
  static Future<Map<String, dynamic>> refreshToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString('refresh_token');

      if (refreshToken == null) {
        return {'success': false, 'message': 'No refresh token available'};
      }

      // Use the auth refresh endpoint
      final response = await http.post(
        Uri.parse('$baseUrl/auth/refresh/'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh': refreshToken}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        // Save new access token
        final newAccessToken = data['access'] ?? data['access_token'];
        if (newAccessToken != null) {
          await prefs.setString('access_token', newAccessToken);
          // If a new refresh token is provided, save it too
          if (data['refresh'] != null) {
            await prefs.setString('refresh_token', data['refresh']);
          }
          return {'success': true, 'access_token': newAccessToken};
        }
        return {'success': false, 'message': 'Invalid token response'};
      } else {
        // Refresh token expired, clear all tokens
        await prefs.remove('access_token');
        await prefs.remove('refresh_token');
        await prefs.remove('user_id');
        await prefs.remove('username');
        return {'success': false, 'message': 'Refresh token expired. Please login again.'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Token refresh error: $e'};
    }
  }

  // Check if error is a token expiration error
  static bool _isTokenError(Map<String, dynamic>? data) {
    if (data == null) return false;
    
    final errorCode = data['code']?.toString().toLowerCase() ?? '';
    final errorDetail = data['detail']?.toString().toLowerCase() ?? '';
    final messages = data['messages'];
    
    return errorCode.contains('token') || 
           errorDetail.contains('token') ||
           (messages is Map && messages.toString().toLowerCase().contains('token'));
  }

  // Logout
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_id');
    await prefs.remove('username');
  }

  // Change password
  static Future<Map<String, dynamic>> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/change-password/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'old_password': oldPassword,
          'new_password': newPassword,
        }),
      );

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server'};
      }

      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Password changed successfully'};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to change password'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Check if user is logged in
  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token') != null;
  }

  // Get username
  static Future<String?> getUsername() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('username');
  }

  // Get user role
  static Future<String?> getUserRole() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_role');
  }

  // Get user's role information
  static Future<Map<String, dynamic>> getMyRole() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      var response = await http.get(
        Uri.parse('$baseUrl/auth/my-role/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // If token expired, refresh and retry
      if (response.statusCode == 401) {
        final refreshResult = await refreshToken();
        if (refreshResult['success'] == true) {
          token = prefs.getString('access_token');
          response = await http.get(
            Uri.parse('$baseUrl/auth/my-role/'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          );
        } else {
          return {
            'success': false,
            'message': refreshResult['message'] ?? 'Session expired. Please login again.'
          };
        }
      }

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint /api/auth/my-role/ may not exist (404).'};
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // Store role locally
        await prefs.setString('user_role', data['role'] ?? 'unassigned');
        await prefs.setString('user_role_display', data['role_display'] ?? 'Unassigned');
        return {'success': true, 'data': data};
      } else {
        String errorMsg = 'Failed to load role (Status: ${response.statusCode})';
        try {
          final errorData = jsonDecode(response.body);
          if (errorData is Map && errorData.containsKey('message')) {
            errorMsg = errorData['message'];
          }
        } catch (_) {}
        return {'success': false, 'message': errorMsg};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if /api/auth/my-role/ endpoint exists.';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get all available roles
  static Future<Map<String, dynamic>> getRoles() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/roles/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint /api/auth/roles/ may not exist (404).'};
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        String errorMsg = 'Failed to load roles (Status: ${response.statusCode})';
        try {
          final errorData = jsonDecode(response.body);
          if (errorData is Map && errorData.containsKey('message')) {
            errorMsg = errorData['message'];
          }
        } catch (_) {}
        return {'success': false, 'message': errorMsg};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if /api/auth/roles/ endpoint exists.';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Assign role to user (Admin only)
  static Future<Map<String, dynamic>> assignRole({
    required int userId,
    required String role,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/assign-role/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'user_id': userId,
          'role': role,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign role'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get all users (Admin only)
  static Future<Map<String, dynamic>> getAllUsers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/users/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML. Endpoint /api/auth/users/ may not exist (404).'};
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load users'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // ========== ATTENDANCE ENDPOINTS ==========

  // Mark attendance (check-in)
  static Future<Map<String, dynamic>> markAttendance() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/attendance/mark/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return {'success': false, 'message': 'Empty response from server. Backend may have crashed or endpoint does not exist.'};
      }
      if (responseBody.startsWith('<!DOCTYPE') || 
          responseBody.startsWith('<html') || 
          responseBody.startsWith('<!doctype') ||
          responseBody.toLowerCase().contains('<!doctype') ||
          responseBody.toLowerCase().contains('<html')) {
        return {'success': false, 'message': 'Server returned HTML error page instead of JSON.\n\nThis means the backend endpoint /api/attendance/mark/ may not exist or the backend has an error.\n\nPlease check:\n1. Backend is running (python manage.py runserver)\n2. Backend terminal for error messages\n3. URL in browser: http://127.0.0.1:8000/api/attendance/mark/'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response. Server may have returned an error page.'};
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': data};
      } else {
        String errorMsg = 'Failed to mark attendance';
        if (data.containsKey('error')) {
          errorMsg = data['error'].toString();
        } else if (data.containsKey('message')) {
          errorMsg = data['message'].toString();
        } else if (data.containsKey('detail')) {
          errorMsg = data['detail'].toString();
        }
        return {'success': false, 'message': errorMsg};
      }
    } catch (e) {
      String errorStr = e.toString();
      String errorMsg = 'Connection error';
      
      // Detect HTML response errors
      if (errorStr.contains('FormatException') || errorStr.contains('<!DOCTYPE') || errorStr.contains('<html')) {
        errorMsg = 'Server returned HTML error page instead of JSON. This means:\n'
            '1. Backend endpoint may not exist (404 error)\n'
            '2. Backend has a server error (500 error)\n'
            '3. Backend is not running properly\n\n'
            'Check your backend terminal for errors. Make sure backend is running: python manage.py runserver';
      } else if (errorStr.contains('Connection refused')) {
        errorMsg = 'Connection refused. Backend server is not running. Start it with: python manage.py runserver';
      } else if (errorStr.contains('Failed host lookup') || errorStr.contains('Network is unreachable')) {
        errorMsg = 'Cannot connect to server. Check API URL: $baseUrl\nMake sure backend is running on your computer.';
      } else if (errorStr.contains('TimeoutException')) {
        errorMsg = 'Request timed out. Backend may be slow or not responding.';
      } else {
        errorMsg = 'Error: ${errorStr.length > 150 ? errorStr.substring(0, 150) + "..." : errorStr}';
      }
      
      print('❌ markAttendance error: $errorStr');
      return {'success': false, 'message': errorMsg};
    }
  }

  // Leave early (check-out before 5 PM)
  static Future<Map<String, dynamic>> leaveEarly() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/attendance/leave-early/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to mark early leave'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Regular check-out at 5 PM
  static Future<Map<String, dynamic>> checkOut() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/attendance/checkout/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to check out'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Start overtime
  static Future<Map<String, dynamic>> startOvertime() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/attendance/overtime/start/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to start overtime'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // End overtime
  static Future<Map<String, dynamic>> endOvertime() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/attendance/overtime/end/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to end overtime'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get today's attendance
  static Future<Map<String, dynamic>> getTodayAttendance() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/attendance/today/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML. Endpoint /api/attendance/today/ may not exist (404).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response. Server may have returned an error page.'};
      }

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load attendance (Status: ${response.statusCode})'};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if /api/attendance/today/ endpoint exists.';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get attendance summary
  static Future<Map<String, dynamic>> getAttendanceSummary({String period = 'daily'}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/attendance/summary/?period=$period'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': ''}; // Return empty message to suppress error display
      }

      // Check if response is JSON
      String contentType = response.headers['content-type'] ?? '';
      if (!contentType.contains('application/json')) {
        return {'success': false, 'message': ''}; // Return empty message to suppress error display
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        return {'success': false, 'message': ''}; // Return empty message to suppress error display
      }

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        // Only return error message for non-server errors
        if (response.statusCode != 500 && response.statusCode != 404) {
          return {'success': false, 'message': 'Failed to load summary (Status: ${response.statusCode})'};
        }
        return {'success': false, 'message': ''}; // Suppress server errors
      }
    } catch (e) {
      // Suppress connection errors - return empty message
      return {'success': false, 'message': ''};
    }
  }

  // ========== PROJECT ENDPOINTS ==========

  // Get all projects
  static Future<Map<String, dynamic>> getProjects() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      var response = await http.get(
        Uri.parse('$baseUrl/projects/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // If token expired, refresh and retry
      if (response.statusCode == 401) {
        final refreshResult = await refreshToken();
        if (refreshResult['success'] == true) {
          token = prefs.getString('access_token');
          response = await http.get(
            Uri.parse('$baseUrl/projects/'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          );
        } else {
          return {
            'success': false,
            'message': refreshResult['message'] ?? 'Session expired. Please login again.'
          };
        }
      }

      // Check if response is JSON
      String contentType = response.headers['content-type'] ?? '';
      if (!contentType.contains('application/json')) {
        return {
          'success': false,
          'message': 'Server error. Please check if the backend server is running.'
        };
      }

      try {
        final data = jsonDecode(response.body);

        if (response.statusCode == 200) {
          // Backend returns a list directly, so wrap it in data
          return {'success': true, 'data': data is List ? data : (data['results'] ?? data)};
        } else {
          return {
            'success': false,
            'message': data is Map && data.containsKey('error')
                ? data['error'].toString()
                : 'Failed to load projects'
          };
        }
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: ${e.toString()}'};
    }
  }

  // Project visit scheduling (Field Officer)
  static Future<Map<String, dynamic>> getProjectVisits(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};

      var response = await http.get(
        Uri.parse('$baseUrl/projects/$projectId/visits/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 401) {
        final refreshResult = await refreshToken();
        if (refreshResult['success'] == true) {
          token = prefs.getString('access_token');
          response = await http.get(
            Uri.parse('$baseUrl/projects/$projectId/visits/'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          );
        } else {
          return {
            'success': false,
            'message': refreshResult['message'] ?? 'Session expired. Please login again.',
          };
        }
      }

      final dynamic data = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 200) {
        final visits = data is List ? data : (data is Map<String, dynamic> ? (data['results'] ?? <dynamic>[]) : <dynamic>[]);
        return {'success': true, 'data': visits};
      }
      final message = data is Map<String, dynamic>
          ? (data['detail'] ?? data['error'] ?? data['message'] ?? 'Failed to load valuation dates')
          : 'Failed to load valuation dates';
      return {'success': false, 'message': message.toString()};
    } catch (e) {
      final errorText = e.toString();
      final isNetworkError =
          e is SocketException ||
          errorText.contains('ClientException') ||
          errorText.contains('Connection failed') ||
          errorText.contains('Connection refused') ||
          errorText.contains('Failed host lookup') ||
          errorText.contains('Network is unreachable') ||
          errorText.contains('timed out');
      if (isNetworkError) {
        return {
          'success': false,
          'message': 'You are offline. Connect to the internet to load valuation dates.',
        };
      }
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> scheduleProjectVisit({
    required int projectId,
    required DateTime scheduledDate,
    String? notes,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};

      var response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/visits/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'scheduled_date': DateFormat('yyyy-MM-dd').format(scheduledDate),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        }),
      );

      if (response.statusCode == 401) {
        final refreshResult = await refreshToken();
        if (refreshResult['success'] == true) {
          token = prefs.getString('access_token');
          response = await http.post(
            Uri.parse('$baseUrl/projects/$projectId/visits/'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'scheduled_date': DateFormat('yyyy-MM-dd').format(scheduledDate),
              if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
            }),
          );
        } else {
          return {
            'success': false,
            'message': refreshResult['message'] ?? 'Session expired. Please login again.',
          };
        }
      }

      final dynamic data = response.body.isNotEmpty ? jsonDecode(response.body) : null;
      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true, 'data': data};
      }

      String message = 'Failed to set valuation date';
      if (data is Map<String, dynamic>) {
        final detail = data['detail'] ?? data['error'] ?? data['message'];
        if (detail is String && detail.trim().isNotEmpty) {
          message = detail;
        } else {
          // DRF validation error map
          final firstValue = data.values.isNotEmpty ? data.values.first : null;
          if (firstValue is List && firstValue.isNotEmpty) {
            message = firstValue.first.toString();
          }
        }
      }
      return {'success': false, 'message': message};
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Create project
  static Future<Map<String, dynamic>> createProject({
    required String title,
    String? description,
    DateTime? startDate,
    DateTime? endDate,
    String priority = 'medium',
    Map<String, dynamic>? clientInfo,
    Map<String, dynamic>? agentInfo,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = {
        'title': title,
        if (description != null) 'description': description,
        if (startDate != null) 'start_date': startDate.toIso8601String().split('T')[0],
        if (endDate != null) 'end_date': endDate.toIso8601String().split('T')[0],
        'priority': priority,
        if (clientInfo != null) 'client_info': clientInfo,
        if (agentInfo != null) 'agent_info': agentInfo,
        'has_agent': agentInfo != null, // Track if agent is required
      };

      // Make the request (with retry logic for token refresh)
      http.Response response = await http.post(
        Uri.parse('$baseUrl/projects/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      // Check if response is JSON before parsing
      String contentType = response.headers['content-type'] ?? '';
      if (!contentType.contains('application/json')) {
        // Server returned HTML (likely an error page)
        return {
          'success': false,
          'message': 'Server error. Please check if the backend server is running.'
        };
      }

      try {
        var data = jsonDecode(response.body);

        // Check if token expired (401 or token error)
        if (response.statusCode == 401 || (response.statusCode != 201 && _isTokenError(data))) {
          // Try to refresh token
          final refreshResult = await refreshToken();
          if (refreshResult['success'] == true) {
            // Retry the request with new token
            token = prefs.getString('access_token');
            response = await http.post(
              Uri.parse('$baseUrl/projects/'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(body),
            );

            // Parse the retry response
            if (response.headers['content-type']?.contains('application/json') == true) {
              final retryData = jsonDecode(response.body);
              if (response.statusCode == 201) {
                return {'success': true, 'data': retryData};
              }
              // If still failing after refresh, return the error
              data = retryData;
            }
          } else {
            // Token refresh failed, return error
            return {
              'success': false,
              'message': refreshResult['message'] ?? 'Session expired. Please login again.'
            };
          }
        }

        if (response.statusCode == 201) {
          return {'success': true, 'data': data};
        } else {
          // Handle validation errors
          if (data is Map<String, dynamic>) {
            String errorMessage = '';
            if (data.containsKey('error')) {
              errorMessage = data['error'].toString();
            } else if (data.containsKey('message')) {
              errorMessage = data['message'].toString();
            } else if (data.containsKey('detail')) {
              errorMessage = data['detail'].toString();
            } else if (data.containsKey('non_field_errors')) {
              errorMessage = (data['non_field_errors'] as List).join(', ');
            } else {
              // Check for field-specific errors
              final errors = <String>[];
              data.forEach((key, value) {
                if (value is List) {
                  errors.add('${key}: ${value.join(', ')}');
                } else if (value is String) {
                  errors.add('${key}: $value');
                }
              });
              errorMessage = errors.isNotEmpty ? errors.join('\n') : 'Failed to create project';
            }
            return {'success': false, 'message': errorMessage};
          }
          return {'success': false, 'message': 'Failed to create project'};
        }
      } catch (e) {
        // If JSON parsing fails, return a user-friendly error
        return {
          'success': false,
          'message': 'Invalid response from server. Please try again.'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: ${e.toString()}'};
    }
  }

  // Get available field officers
  static Future<Map<String, dynamic>> getAvailableFieldOfficers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/field-officers/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load field officers'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Assign field officer to project
  static Future<Map<String, dynamic>> assignFieldOfficer({
    required int projectId,
    required int fieldOfficerId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/assign-field-officer/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'field_officer_id': fieldOfficerId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign field officer'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get available clients
  static Future<Map<String, dynamic>> getAvailableClients() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/clients/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load clients'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get available agents
  static Future<Map<String, dynamic>> getAvailableAgents() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/agents/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load agents'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Assign client to project
  static Future<Map<String, dynamic>> assignClient({
    required int projectId,
    required int clientId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/assign-client/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'client_id': clientId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign client'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Assign agent to project
  static Future<Map<String, dynamic>> assignAgent({
    required int projectId,
    required int agentId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/assign-agent/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'agent_id': agentId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign agent'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get available accessors
  static Future<Map<String, dynamic>> getAvailableAccessors() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/accessors/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load accessors'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Assign accessor to project
  static Future<Map<String, dynamic>> assignAccessor({
    required int projectId,
    required int accessorId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/assign-accessor/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'accessor_id': accessorId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign accessor'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get available senior valuers
  static Future<Map<String, dynamic>> getAvailableSeniorValuers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/senior-valuers/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load senior valuers'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Assign senior valuer to project
  static Future<Map<String, dynamic>> assignSeniorValuer({
    required int projectId,
    required int seniorValuerId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/assign-senior-valuer/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'senior_valuer_id': seniorValuerId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to assign senior valuer'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get projects assigned to a user
  static Future<Map<String, dynamic>> getUserAssignedProjects({
    required int userId,
    required String roleType,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/users/$userId/projects/$roleType/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to load assigned projects'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Update project
  static Future<Map<String, dynamic>> updateProject({
    required int projectId,
    String? title,
    String? description,
    DateTime? startDate,
    DateTime? endDate,
    String? priority,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (description != null) body['description'] = description;
      if (startDate != null) body['start_date'] = startDate.toIso8601String().split('T')[0];
      if (endDate != null) body['end_date'] = endDate.toIso8601String().split('T')[0];
       if (priority != null) body['priority'] = priority;

      final response = await http.patch(
        Uri.parse('$baseUrl/projects/$projectId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      // Check if response is JSON
      String contentType = response.headers['content-type'] ?? '';
      if (!contentType.contains('application/json')) {
        return {
          'success': false,
          'message': 'Server error. Please check if the backend server is running.'
        };
      }

      try {
        final data = jsonDecode(response.body);

        if (response.statusCode == 200) {
          return {'success': true, 'data': data};
        } else {
          if (data is Map<String, dynamic>) {
            String errorMessage = '';
            if (data.containsKey('error')) {
              errorMessage = data['error'].toString();
            } else if (data.containsKey('message')) {
              errorMessage = data['message'].toString();
            } else if (data.containsKey('non_field_errors')) {
              errorMessage = (data['non_field_errors'] as List).join(', ');
            } else {
              final errors = <String>[];
              data.forEach((key, value) {
                if (value is List) {
                  errors.add('${key}: ${value.join(', ')}');
                } else if (value is String) {
                  errors.add('${key}: $value');
                }
              });
              errorMessage = errors.isNotEmpty ? errors.join('\n') : 'Failed to update project';
            }
            return {'success': false, 'message': errorMessage};
          }
          return {'success': false, 'message': 'Failed to update project'};
        }
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: ${e.toString()}'};
    }
  }

  // Update project status
  static Future<Map<String, dynamic>> updateProjectStatus({
    required int projectId,
    required String status,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.patch(
        Uri.parse('$baseUrl/projects/$projectId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'status': status,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? data.toString()};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Upload document to project
  static Future<Map<String, dynamic>> uploadProjectDocument({
    required int projectId,
    required String filePath,
    required String fileName,
    String? description,
    int? assignedToId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/projects/documents/'),
      );

      request.headers.addAll({
        'Authorization': 'Bearer $token',
      });

      request.fields['project'] = projectId.toString();
      request.fields['name'] = fileName;
      if (description != null) {
        request.fields['description'] = description;
      }
      if (assignedToId != null) {
        request.fields['assigned_to'] = assignedToId.toString();
      }

      final file = await http.MultipartFile.fromPath('file', filePath);
      request.files.add(file);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to upload document'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Delete project
  static Future<Map<String, dynamic>> deleteProject(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/projects/$projectId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 204 || response.statusCode == 200) {
        return {'success': true};
      } else {
        final data = jsonDecode(response.body);
        return {'success': false, 'message': data['error'] ?? data.toString()};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Delete project document
  static Future<Map<String, dynamic>> deleteProjectDocument(int documentId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/projects/documents/$documentId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 204 || response.statusCode == 200) {
        return {'success': true};
      } else {
        final data = jsonDecode(response.body);
        return {'success': false, 'message': data['error'] ?? 'Failed to delete document'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get project detail
  static Future<Map<String, dynamic>> getProject(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/projects/$projectId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load project'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Submit project to accessor / next stage
  static Future<Map<String, dynamic>> submitProject(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/start-project/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Guard against Django HTML error pages (404/500) to avoid FormatException
      final body = response.body.trim();
      if (body.startsWith('<!DOCTYPE') || body.startsWith('<html')) {
        return {
          'success': false,
          'message': 'Server returned HTML. Submit endpoint may be missing or backend has an error.',
        };
      }

      Map<String, dynamic> data = {};
      if (body.isNotEmpty) {
        try {
          final decoded = jsonDecode(body);
          if (decoded is Map<String, dynamic>) {
            data = decoded;
          }
        } catch (_) {
          return {
            'success': false,
            'message': 'Invalid response from server while submitting project.',
          };
        }
      }

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? data['detail'] ?? 'Failed to submit project'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Valuation API methods
  static Future<Map<String, dynamic>> getValuations({int? projectId}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      String url = '$baseUrl/valuations/';
      if (projectId != null) {
        url += '?project=$projectId';
      }

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['detail'] ?? 'Failed to load valuations'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> getValuation(int valuationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/valuations/$valuationId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['detail'] ?? 'Failed to load valuation'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> createValuation(Map<String, dynamic> valuationData) async {
    try {
      // Field officers can work fully offline: queue valuation locally when
      // there is no real network/backend connectivity.
      final offlineModeEnabled = await OfflineDBService.isOfflineModeEnabled();
      if (offlineModeEnabled) {
        if (!NetworkService.isInitialized) {
          await NetworkService.init();
        }
        final isOnline = await NetworkService.checkConnectivity();
        if (!isOnline) {
          final localId = await OfflineStorageService.saveValuationOffline(valuationData);
          return {
            'success': true,
            'synced': false,
            'data': {'localId': localId, ...valuationData},
            'message': 'Saved offline. Will sync automatically when online.',
          };
        }
      }

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/valuations/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(valuationData),
      );

      final responseBody = response.body;
      Map<String, dynamic> data;
      
      try {
        data = jsonDecode(responseBody);
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server: $responseBody'};
      }

      if (response.statusCode == 201) {
        return {'success': true, 'data': data, 'synced': true};
      } else {
        // Try to extract detailed error messages
        String errorMessage = 'Failed to create valuation';
        
        // Check for errors dictionary (Django REST Framework format)
        if (data.containsKey('errors')) {
          final errors = data['errors'];
          if (errors is Map) {
            final fieldErrors = <String>[];
            errors.forEach((key, value) {
              if (value is List && value.isNotEmpty) {
                fieldErrors.add('$key: ${value.join(", ")}');
              } else if (value is String && value.isNotEmpty) {
                fieldErrors.add('$key: $value');
              }
            });
            if (fieldErrors.isNotEmpty) {
              errorMessage = fieldErrors.join('\n');
            }
          }
        } else if (data.containsKey('detail')) {
          errorMessage = data['detail'].toString();
        } else if (data.containsKey('message')) {
          errorMessage = data['message'].toString();
        } else if (data.containsKey('error')) {
          errorMessage = data['error'].toString();
        } else if (data.containsKey('non_field_errors')) {
          errorMessage = data['non_field_errors'].toString();
        } else {
          // Check for field-specific errors (direct in response)
          final fieldErrors = <String>[];
          data.forEach((key, value) {
            if (key != 'success' && value != null) {
              if (value is List && value.isNotEmpty) {
                fieldErrors.add('$key: ${value.join(", ")}');
              } else if (value is String && value.isNotEmpty) {
                fieldErrors.add('$key: $value');
              }
            }
          });
          if (fieldErrors.isNotEmpty) {
            errorMessage = fieldErrors.join('\n');
          } else {
            errorMessage = 'Status ${response.statusCode}: ${responseBody}';
          }
        }
        
        // Log full response for debugging
        print('Valuation creation error response: $responseBody');
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      // Network failures in offline mode should queue locally instead of showing
      // a blocking connection error to field officers.
      final errorText = e.toString();
      final isNetworkFailure =
          e is SocketException ||
          errorText.contains('ClientException') ||
          errorText.contains('Connection failed') ||
          errorText.contains('Connection refused') ||
          errorText.contains('Failed host lookup') ||
          errorText.contains('Network is unreachable') ||
          errorText.contains('timed out');

      if (isNetworkFailure && await OfflineDBService.isOfflineModeEnabled()) {
        try {
          final localId = await OfflineStorageService.saveValuationOffline(valuationData);
          return {
            'success': true,
            'synced': false,
            'data': {'localId': localId, ...valuationData},
            'message': 'Saved offline. Will sync automatically when online.',
          };
        } catch (_) {
          // Fall through to the original connection error if offline queue fails.
        }
      }

      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> deleteValuation(int valuationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/valuations/$valuationId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 204 || response.statusCode == 200) {
        return {'success': true};
      } else {
        final data = jsonDecode(response.body);
        return {'success': false, 'message': data['detail'] ?? 'Failed to delete valuation'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> syncValuationToServer(Map<String, dynamic> apiData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      // If it has an id, it might be an update, otherwise create
      final response = await http.post(
        Uri.parse('$baseUrl/valuations/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(apiData),
      );

      final responseBody = response.body;
      Map<String, dynamic> data;
      try {
        data = jsonDecode(responseBody);
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server: $responseBody'};
      }

      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['detail'] ?? data.toString()};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> updateValuation(int valuationId, Map<String, dynamic> valuationData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.patch(
        Uri.parse('$baseUrl/valuations/$valuationId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(valuationData),
      );

      final responseBody = response.body;
      Map<String, dynamic> data;
      
      try {
        data = jsonDecode(responseBody);
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server: $responseBody'};
      }

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        // Try to extract detailed error messages
        String errorMessage = 'Failed to update valuation';
        if (data.containsKey('detail')) {
          errorMessage = data['detail'].toString();
        } else if (data.containsKey('message')) {
          errorMessage = data['message'].toString();
        } else if (data.containsKey('error')) {
          errorMessage = data['error'].toString();
        } else if (data.containsKey('non_field_errors')) {
          errorMessage = data['non_field_errors'].toString();
        } else {
          // Check for field-specific errors
          final fieldErrors = <String>[];
          data.forEach((key, value) {
            if (value is List && value.isNotEmpty) {
              fieldErrors.add('$key: ${value.join(", ")}');
            } else if (value is String && value.isNotEmpty) {
              fieldErrors.add('$key: $value');
            }
          });
          if (fieldErrors.isNotEmpty) {
            errorMessage = fieldErrors.join('\n');
          } else {
            errorMessage = 'Status ${response.statusCode}: ${responseBody}';
          }
        }
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> submitValuation(int valuationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/valuations/$valuationId/submit/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? data['detail'] ?? 'Failed to submit valuation'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> uploadSubmittedReport(int valuationId, String pdfPath) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/valuations/$valuationId/upload-report/'),
      );

      request.headers['Authorization'] = 'Bearer $token';
      final file = await http.MultipartFile.fromPath('submitted_report', pdfPath);
      request.files.add(file);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['detail'] ?? data['message'] ?? 'Failed to upload report'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  static Future<Map<String, dynamic>> uploadValuationPhoto(
    int valuationId,
    String photoPath, {
    String? caption,
    bool isPrimary = false,
    int? ordering,
    String? capturedAt,
    double? gpsLat,
    double? gpsLon,
    String? deviceId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/valuations/$valuationId/photos/'),
      );

      request.headers['Authorization'] = 'Bearer $token';
      request.fields['valuation'] = valuationId.toString();
      if (caption != null && caption.isNotEmpty) {
        request.fields['caption'] = caption;
      }
      if (isPrimary) request.fields['is_primary'] = 'true';
      if (ordering != null) request.fields['ordering'] = ordering.toString();
      if (capturedAt != null && capturedAt.isNotEmpty) request.fields['captured_at'] = capturedAt;
      if (gpsLat != null) request.fields['gps_lat'] = gpsLat.toStringAsFixed(6);
      if (gpsLon != null) request.fields['gps_lon'] = gpsLon.toStringAsFixed(6);
      if (deviceId != null && deviceId.isNotEmpty) request.fields['device_id'] = deviceId;

      final file = await http.MultipartFile.fromPath('photo', photoPath);
      request.files.add(file);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['detail'] ?? data['message'] ?? 'Failed to upload photo'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  /// Feature #9: Reorder valuation photos. Takes an ordered list of photo IDs.
  static Future<Map<String, dynamic>> reorderValuationPhotos(
    int valuationId,
    List<int> orderedPhotoIds,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.patch(
        Uri.parse('$baseUrl/valuations/$valuationId/photos/reorder/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'photo_ids': orderedPhotoIds}),
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  /// Feature #9: Mark a photo as the primary photo for a valuation.
  static Future<Map<String, dynamic>> setPrimaryValuationPhoto(int valuationId, int photoId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.post(
        Uri.parse('$baseUrl/valuations/$valuationId/photos/$photoId/set-primary/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> deleteValuationPhoto(int photoId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/valuations/photos/$photoId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 204 || response.statusCode == 200) {
        return {'success': true};
      } else {
        final data = jsonDecode(response.body);
        return {'success': false, 'message': data['detail'] ?? 'Failed to delete photo'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // ========== PAYMENT SLIP ENDPOINTS ==========

  // Generate payment slips for all users (Admin only)
  static Future<Map<String, dynamic>> generatePaymentSlips({int? month, int? year}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{};
      if (month != null) body['month'] = month;
      if (year != null) body['year'] = year;

      final response = await http.post(
        Uri.parse('$baseUrl/auth/payment-slips/generate/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to generate payment slips'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get current user's payment slips
  static Future<Map<String, dynamic>> getMyPaymentSlips() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/payment-slips/my/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML. Endpoint /api/auth/payment-slips/my/ may not exist or backend has an error (404/500).'};
      }

      // Check if response is JSON
      String contentType = response.headers['content-type'] ?? '';
      if (!contentType.contains('application/json')) {
        return {
          'success': false,
          'message': 'Server error. Please check if the backend server is running.'
        };
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // DRF ListAPIView returns a list directly, or wrapped in 'results' for pagination
        if (data is List) {
          return {'success': true, 'data': data};
        } else if (data is Map && data.containsKey('results')) {
          return {'success': true, 'data': data['results']};
        } else {
          return {'success': true, 'data': []};
        }
      } else {
        Map<String, dynamic> errorData;
        try {
          errorData = jsonDecode(response.body);
        } catch (e) {
          return {
            'success': false,
            'message': 'Failed to load payment slips (Status: ${response.statusCode})'
          };
        }
        return {
          'success': false,
          'message': errorData['detail'] ?? errorData['message'] ?? 'Failed to load payment slips'
        };
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else if (e.toString().contains('Failed host lookup') || e.toString().contains('Network is unreachable')) {
        errorMsg = 'Cannot connect to server. Make sure the backend is running at $baseUrl';
      } else {
        errorMsg = 'Connection error: $e';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get all payment slips (Admin only)
  static Future<Map<String, dynamic>> getAllPaymentSlips({int? month, int? year, int? userId}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final queryParams = <String>[];
      if (month != null) queryParams.add('month=$month');
      if (year != null) queryParams.add('year=$year');
      if (userId != null) queryParams.add('user_id=$userId');

      String url = '$baseUrl/auth/payment-slips/';
      if (queryParams.isNotEmpty) {
        url += '?${queryParams.join('&')}';
      }

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load payment slips'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get payment slip detail
  static Future<Map<String, dynamic>> getPaymentSlipDetail(int slipId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/payment-slips/$slipId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load payment slip'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Upload overtime hours for a specific payment slip
  static Future<Map<String, dynamic>> uploadOvertimeHours({
    required int slipId,
    required double overtimeHours,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/payment-slips/$slipId/upload-overtime/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'overtime_hours': overtimeHours,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data['data']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to upload overtime hours'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Upload overtime hours for all payment slips
  static Future<Map<String, dynamic>> uploadAllOvertimeHours({
    int? month,
    int? year,
    required List<Map<String, dynamic>> overtimeData,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{
        'overtime_data': overtimeData,
      };
      if (month != null) body['month'] = month;
      if (year != null) body['year'] = year;

      final response = await http.post(
        Uri.parse('$baseUrl/auth/payment-slips/upload-all-overtime/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Overtime hours uploaded successfully',
          'updated_count': data['updated_count'] ?? 0,
          'errors': data['errors'],
        };
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to upload overtime hours'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Upload/publish payment slips for employees to view
  static Future<Map<String, dynamic>> uploadPaymentSlips({int? month, int? year}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{};
      if (month != null) body['month'] = month;
      if (year != null) body['year'] = year;

      final response = await http.post(
        Uri.parse('$baseUrl/auth/payment-slips/upload/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to upload payment slips'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Delete payment slip
  static Future<Map<String, dynamic>> deletePaymentSlip({
    required int slipId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/auth/payment-slips/$slipId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      if (response.statusCode == 200 || response.statusCode == 204) {
        Map<String, dynamic> data = {};
        if (response.body.isNotEmpty) {
          try {
            data = jsonDecode(response.body) as Map<String, dynamic>;
          } catch (e) {
            // If response body is empty, that's fine for DELETE
          }
        }
        return {
          'success': true,
          'message': data['message'] ?? 'Payment slip deleted successfully',
          'data': data
        };
      } else {
        Map<String, dynamic> errorData = {};
        try {
          errorData = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (e) {
          // Ignore parse errors
        }
        
        String errorMessage = 'Failed to delete payment slip';
        if (errorData.containsKey('error')) {
          errorMessage = errorData['error'].toString();
        } else if (errorData.containsKey('detail')) {
          errorMessage = errorData['detail'].toString();
        } else if (errorData.containsKey('message')) {
          errorMessage = errorData['message'].toString();
        }
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') || e.toString().contains('jsonDecode')) {
        errorMsg = 'Server returned invalid response. Please check your connection and try again.';
      } else if (e.toString().contains('SocketException') || e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Delete user from database (Admin only)
  static Future<Map<String, dynamic>> deleteUser({
    required int userId,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/auth/users/$userId/delete/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      if (response.statusCode == 200) {
        Map<String, dynamic> data = {};
        if (response.body.isNotEmpty) {
          try {
            data = jsonDecode(response.body) as Map<String, dynamic>;
          } catch (e) {
            // If response body is empty, that's fine for DELETE
          }
        }
        return {
          'success': true,
          'message': data['message'] ?? 'User deleted successfully',
          'data': data
        };
      } else {
        Map<String, dynamic> errorData = {};
        try {
          errorData = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (e) {
          // Ignore parse errors
        }
        
        String errorMessage = 'Failed to delete user';
        if (errorData.containsKey('error')) {
          errorMessage = errorData['error'].toString();
        } else if (errorData.containsKey('detail')) {
          errorMessage = errorData['detail'].toString();
        } else if (errorData.containsKey('message')) {
          errorMessage = errorData['message'].toString();
        }
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') || e.toString().contains('jsonDecode')) {
        errorMsg = 'Server returned invalid response. Please check your connection and try again.';
      } else if (e.toString().contains('SocketException') || e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Update payment slip
  static Future<Map<String, dynamic>> updatePaymentSlip({
    required int slipId,
    double? salary,
    double? allowances,
    double? epfContribution,
    double? overtimePay,
    double? overtimeHours,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{};
      if (salary != null) body['salary'] = salary;
      if (allowances != null) body['allowances'] = allowances;
      if (epfContribution != null) body['epf_contribution'] = epfContribution;
      if (overtimePay != null) body['overtime_pay'] = overtimePay;
      if (overtimeHours != null) body['overtime_hours'] = overtimeHours;

      final response = await http.patch(
        Uri.parse('$baseUrl/auth/payment-slips/$slipId/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        return {'success': false, 'message': 'Invalid response from server: ${response.body.substring(0, 100)}'};
      }

      if (response.statusCode == 200) {
        // Success - return success with data
        return {'success': true, 'data': data};
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        // Any 2xx status is success
        return {'success': true, 'data': data};
      } else {
        // Only return error for actual error status codes (4xx, 5xx)
        // Extract error message from response
        String errorMessage = 'Failed to update payment slip';
        if (data.containsKey('error')) {
          errorMessage = data['error'].toString();
        } else if (data.containsKey('detail')) {
          errorMessage = data['detail'].toString();
        } else if (data.containsKey('message')) {
          // Check if message is actually an error or just informational
          final message = data['message'].toString();
          if (message.toLowerCase().contains('success') || 
              message.toLowerCase().contains('updated') ||
              message.toLowerCase().contains('saved')) {
            // This is a success message, not an error
            return {'success': true, 'data': data, 'message': message};
          }
          errorMessage = message;
        } else if (data.containsKey('non_field_errors')) {
          if (data['non_field_errors'] is List && (data['non_field_errors'] as List).isNotEmpty) {
            errorMessage = (data['non_field_errors'] as List).first.toString();
          } else {
            errorMessage = data['non_field_errors'].toString();
          }
        } else {
          // Get first error from any field
          for (var key in data.keys) {
            if (data[key] is List && (data[key] as List).isNotEmpty) {
              errorMessage = '$key: ${(data[key] as List).first}';
              break;
            } else if (data[key] is String) {
              errorMessage = '$key: ${data[key]}';
              break;
            }
          }
        }
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error: $e';
      if (e.toString().contains('FormatException') || e.toString().contains('jsonDecode')) {
        errorMsg = 'Server returned invalid response. Please check your connection and try again.';
      } else if (e.toString().contains('SocketException') || e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get form submissions for coordinator

  // Create leave request
  static Future<Map<String, dynamic>> createLeaveRequest({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/leave-requests/create/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'leave_type': leaveType,
          'start_date': startDate.toIso8601String().split('T')[0], // YYYY-MM-DD format
          'end_date': endDate.toIso8601String().split('T')[0],
          'reason': reason,
        }),
      );

      final data = jsonDecode(response.body);
      
      if (response.statusCode == 201) {
        return {'success': true, 'message': data['message'] ?? 'Leave request submitted successfully', 'data': data['data']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to submit leave request', 'errors': data['errors']};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get all leave requests (admin only)
  static Future<Map<String, dynamic>> getAllLeaveRequests() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/leave-requests/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'message': errorData['error'] ?? 'Failed to load leave requests'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get my leave requests (current user)
  static Future<Map<String, dynamic>> getMyLeaveRequests() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/leave-requests/my/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'message': errorData['error'] ?? 'Failed to load leave requests'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get my leave statistics (current user)
  static Future<Map<String, dynamic>> getMyLeaveStatistics() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/leave-requests/statistics/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data['data']};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'message': errorData['error'] ?? 'Failed to load leave statistics'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get monthly leave summary (admin only)
  static Future<Map<String, dynamic>> getMonthlyLeaveSummary({int? month, int? year}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final now = DateTime.now();
      final queryParams = <String, String>{};
      if (month != null) queryParams['month'] = month.toString();
      if (year != null) queryParams['year'] = year.toString();

      final uri = Uri.parse('$baseUrl/auth/leave-requests/summary/monthly/').replace(
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data['data'] ?? [], 'month': data['month'], 'year': data['year']};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'message': errorData['error'] ?? 'Failed to load leave summary'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Get weekly attendance summary (admin only)
  static Future<Map<String, dynamic>> getWeeklyAttendanceSummary({
    required DateTime weekStart,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final queryParams = <String, String>{
        'week_start': '${weekStart.year}-${weekStart.month.toString().padLeft(2, '0')}-${weekStart.day.toString().padLeft(2, '0')}',
      };

      final uri = Uri.parse('$baseUrl/attendance/summary/weekly/').replace(
        queryParameters: queryParams,
      );

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data['data'] ?? []};
      } else {
        final errorData = jsonDecode(response.body);
        return {'success': false, 'message': errorData['error'] ?? 'Failed to load attendance summary'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Update leave request status (admin only)
  static Future<Map<String, dynamic>> updateLeaveRequestStatus({
    required int requestId,
    required String status,
    String? notes,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final body = <String, dynamic>{'status': status};
      if (notes != null && notes.isNotEmpty) {
        body['notes'] = notes;
      }

      final response = await http.patch(
        Uri.parse('$baseUrl/auth/leave-requests/$requestId/update/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(body),
      );

      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Leave request updated successfully', 'data': data['data']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to update leave request'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Create employee removal request (HR Head only)
  static Future<Map<String, dynamic>> createRemovalRequest({
    required int userId,
    String? reason,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/removal-requests/create/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'user_id': userId,
          'reason': reason ?? '',
        }),
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response from server'};
      }

      if (response.statusCode == 201) {
        return {
          'success': true,
          'message': data['message'] ?? 'Removal request created successfully',
          'data': data['data']
        };
      } else {
        String errorMessage = data['error'] ?? 'Failed to create removal request';
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if the API endpoint exists and backend is running correctly.';
      } else if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else {
        errorMsg = 'Connection error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Get all removal requests (Admin only)
  static Future<Map<String, dynamic>> getAllRemovalRequests() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.get(
        Uri.parse('$baseUrl/auth/removal-requests/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as List<dynamic>;
        return {
          'success': true,
          'data': data
        };
      } else {
        Map<String, dynamic> errorData = {};
        try {
          errorData = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (e) {
          // Ignore parse errors
        }
        
        String errorMessage = errorData['error'] ?? 'Failed to fetch removal requests';
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if the API endpoint exists and backend is running correctly.';
      } else if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else {
        errorMsg = 'Connection error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Approve removal request (Admin only)
  static Future<Map<String, dynamic>> approveRemovalRequest({
    required int requestId,
    String? adminNotes,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/removal-requests/$requestId/approve/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'admin_notes': adminNotes ?? '',
        }),
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response from server'};
      }

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Removal request approved successfully',
          'data': data['data']
        };
      } else {
        String errorMessage = data['error'] ?? 'Failed to approve removal request';
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if the API endpoint exists and backend is running correctly.';
      } else if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else {
        errorMsg = 'Connection error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // Reject removal request (Admin only)
  static Future<Map<String, dynamic>> rejectRemovalRequest({
    required int requestId,
    String? adminNotes,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');

      if (token == null) {
        return {'success': false, 'message': 'Not authenticated'};
      }

      final response = await http.post(
        Uri.parse('$baseUrl/auth/removal-requests/$requestId/reject/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'admin_notes': adminNotes ?? '',
        }),
      );

      // Check if response is HTML (error page)
      if (response.body.trim().startsWith('<!DOCTYPE') || response.body.trim().startsWith('<html')) {
        return {'success': false, 'message': 'Server returned HTML instead of JSON. Endpoint may not exist (404).'};
      }

      Map<String, dynamic> data;
      try {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        return {'success': false, 'message': 'Invalid JSON response from server'};
      }

      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Removal request rejected successfully',
          'data': data['data']
        };
      } else {
        String errorMessage = data['error'] ?? 'Failed to reject removal request';
        return {'success': false, 'message': errorMessage};
      }
    } catch (e) {
      String errorMsg = 'Connection error';
      if (e.toString().contains('FormatException') && e.toString().contains('<!DOCTYPE')) {
        errorMsg = 'Server returned HTML error page. Check if the API endpoint exists and backend is running correctly.';
      } else if (e.toString().contains('Connection refused')) {
        errorMsg = 'Connection refused. Is the backend server running?';
      } else {
        errorMsg = 'Connection error: ${e.toString()}';
      }
      return {'success': false, 'message': errorMsg};
    }
  }

  // ---- Notifications ----

  static Future<Map<String, dynamic>> getNotifications({int page = 1}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.get(
        Uri.parse('$baseUrl/notifications/?page=$page'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'message': 'Failed to load notifications (${response.statusCode})'};
      }
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<void> markNotificationRead(int id) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return;
      await http.post(
        Uri.parse('$baseUrl/notifications/$id/read/'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (_) {}
  }

  static Future<void> markAllNotificationsRead() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return;
      await http.post(
        Uri.parse('$baseUrl/notifications/mark-all-read/'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (_) {}
  }

  // ---- User Profile ----

  static Future<Map<String, dynamic>> getUserProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.get(
        Uri.parse('$baseUrl/auth/profile/me/'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> updateUserProfile(Map<String, dynamic> profileData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.patch(
        Uri.parse('$baseUrl/auth/profile/me/'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode(profileData),
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Update failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  /// Feature #16: Upload a profile avatar (multipart).
  static Future<Map<String, dynamic>> uploadUserAvatar(File imageFile) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/auth/profile/me/avatar/'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(await http.MultipartFile.fromPath('avatar', imageFile.path));
      final streamed = await request.send();
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(body)};
      }
      return {'success': false, 'message': 'Upload failed (${streamed.statusCode}) $body'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // ---- Daily Standups (Feature #1) ----

  static Future<Map<String, dynamic>> getStandupMessages(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.get(
        Uri.parse('$baseUrl/standups/projects/$projectId/messages/'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> postStandupMessage(
    int projectId,
    String body, {
    String kind = 'free',
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.post(
        Uri.parse('$baseUrl/standups/projects/$projectId/messages/post/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'body': body, 'kind': kind}),
      );
      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> getStandupMembers(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.get(
        Uri.parse('$baseUrl/standups/projects/$projectId/members/'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // ---- Consolidated Report Items (Feature #13 — D1) ----

  static Future<Map<String, dynamic>> getReportItems(int projectId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.get(
        Uri.parse('$baseUrl/projects/$projectId/report-items/'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> createReportItem(
    int projectId,
    Map<String, dynamic> data, {
    bool overrideDuplicate = false,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final body = {...data, 'project': projectId, 'override_duplicate': overrideDuplicate};
      final response = await http.post(
        Uri.parse('$baseUrl/projects/$projectId/report-items/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      final err = jsonDecode(response.body);
      if (err is Map && err['duplicate'] == true) {
        return {'success': false, 'duplicate': true, 'existing_id': err['existing_id'], 'message': err['message'] ?? 'Duplicate item'};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> updateReportItem(int itemId, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.patch(
        Uri.parse('$baseUrl/report-items/$itemId/'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(data),
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> deleteReportItem(int itemId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      if (token == null) return {'success': false, 'message': 'Not authenticated'};
      final response = await http.delete(
        Uri.parse('$baseUrl/report-items/$itemId/'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 204 || response.statusCode == 200) {
        return {'success': true};
      }
      return {'success': false, 'message': 'Failed (${response.statusCode})'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}

