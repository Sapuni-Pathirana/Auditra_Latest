import 'package:hive_flutter/hive_flutter.dart';
import 'api_service.dart';

/// Manages the local on-device database for field officers.
///
/// This app uses Hive — a fast key-value store that works completely offline
/// (no internet required). All data is stored as simple key→value pairs on
/// the device's internal storage, organised into five named "boxes":
///
///   - `valuations`     → valuation reports created while offline.
///   - `projects_cache` → project list downloaded from the server so the
///                         field officer can still see projects without internet.
///   - `attendance`     → check-in / check-out records created offline.
///   - `sync_queue`     → submit actions (e.g. "submit this valuation to the
///                         accessor") that are waiting for an internet connection.
///   - `photos_cache`   → file paths and metadata for photos taken offline.
///
/// Only field officers use offline mode. All other roles (accessor, admin, etc.)
/// communicate with the server directly and never call this service.
class OfflineDBService {
  // ─── Hive box names ──────────────────────────────────────────────────────
  // Each string is the key used to open (or create) that Hive box on the device.
  static const String _valuationsBoxName = 'valuations';
  static const String _projectsCacheBoxName = 'projects_cache';
  static const String _attendanceBoxName = 'attendance';
  static const String _syncQueueBoxName = 'sync_queue';
  static const String _photosCacheBoxName = 'photos_cache';
  
  static bool _isInitialized = false;
  
  /// Returns true if [initOfflineDB] has completed successfully.
  /// Always check this before reading or writing any box to avoid errors.
  static bool get isInitialized => _isInitialized;

  /// Sets up all five Hive boxes so offline data can be read and written.
  ///
  /// What it does step by step:
  ///   1. Skips if already initialised (safe to call multiple times).
  ///   2. Checks the logged-in user's role — exits quietly if not a field officer.
  ///   3. Calls `Hive.initFlutter()` to set up the storage folder on the device.
  ///   4. Opens each of the five boxes (creates the files on disk if they don't
  ///      exist yet, like creating new database tables for the first time).
  ///   5. Sets `_isInitialized = true` so other services know it is ready.
  ///
  /// Throws an exception if any box fails to open, so the caller knows
  /// initialisation has failed.
  static Future<void> initOfflineDB() async {
    if (_isInitialized) {
      return;
    }

    // Check if user is field officer
    if (!await isOfflineModeEnabled()) {
      print('Offline mode not enabled for this user');
      return;
    }

    try {
      // Initialize Hive Flutter
      await Hive.initFlutter();
      
      // Open boxes
      await Hive.openBox(_valuationsBoxName);
      await Hive.openBox(_projectsCacheBoxName);
      await Hive.openBox(_attendanceBoxName);
      await Hive.openBox(_syncQueueBoxName);
      await Hive.openBox(_photosCacheBoxName);
      
      _isInitialized = true;
      print('✅ Offline database initialized');
    } catch (e) {
      print('❌ Error initializing offline database: $e');
      rethrow;
    }
  }

  /// Returns true if the currently logged-in user is a field officer.
  ///
  /// Only field officers have offline mode. Other roles (accessor, admin, etc.)
  /// are always expected to be online and never need local storage.
  static Future<bool> isOfflineModeEnabled() async {
    try {
      final role = await ApiService.getUserRole();
      return role == 'field_officer';
    } catch (e) {
      print('Error checking user role: $e');
      return false;
    }
  }

  /// Returns the open Hive box that stores offline valuation reports.
  /// Throws if the database has not been initialised yet.
  static Box get valuationsBox {
    if (!_isInitialized) {
      throw Exception('Offline database not initialized. Call initOfflineDB() first.');
    }
    return Hive.box(_valuationsBoxName);
  }

  /// Returns the open Hive box that stores the cached project list and visit data.
  /// Throws if the database has not been initialised yet.
  static Box get projectsCacheBox {
    if (!_isInitialized) {
      throw Exception('Offline database not initialized. Call initOfflineDB() first.');
    }
    return Hive.box(_projectsCacheBoxName);
  }

  /// Returns the open Hive box that stores offline attendance records (check-in/out).
  /// Throws if the database has not been initialised yet.
  static Box get attendanceBox {
    if (!_isInitialized) {
      throw Exception('Offline database not initialized. Call initOfflineDB() first.');
    }
    return Hive.box(_attendanceBoxName);
  }

  /// Returns the open Hive box that stores pending submit actions waiting to go online.
  /// Throws if the database has not been initialised yet.
  static Box get syncQueueBox {
    if (!_isInitialized) {
      throw Exception('Offline database not initialized. Call initOfflineDB() first.');
    }
    return Hive.box(_syncQueueBoxName);
  }

  /// Returns the open Hive box that stores photo file paths and metadata.
  /// Throws if the database has not been initialised yet.
  static Box get photosCacheBox {
    if (!_isInitialized) {
      throw Exception('Offline database not initialized. Call initOfflineDB() first.');
    }
    return Hive.box(_photosCacheBoxName);
  }

  /// Wipes every record from every box (valuations, projects, attendance,
  /// sync queue, and photos cache). This cannot be undone.
  /// Use only when the user logs out or explicitly requests a full data reset.
  static Future<void> clearAllData() async {
    if (!_isInitialized) return;
    
    await valuationsBox.clear();
    await projectsCacheBox.clear();
    await attendanceBox.clear();
    await syncQueueBox.clear();
    await photosCacheBox.clear();
  }

  /// Returns a count of how many records are stored in each box right now.
  /// Example: `{'valuations': 3, 'sync_queue': 1, ...}`
  /// Returns an empty map if the database has not been initialised yet.
  static Map<String, int> getStats() {
    if (!_isInitialized) {
      return {};
    }
    
    return {
      'valuations': valuationsBox.length,
      'projects': projectsCacheBox.length,
      'attendance': attendanceBox.length,
      'sync_queue': syncQueueBox.length,
      'photos': photosCacheBox.length,
    };
  }
}

