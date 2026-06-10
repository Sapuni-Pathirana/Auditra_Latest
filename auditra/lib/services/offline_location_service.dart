import 'package:geolocator/geolocator.dart';

/// Hardcoded fallback coordinates used when the device cannot get a real GPS fix.
///
/// These coordinates point to a location in Sri Lanka.
/// The accuracy is set to 1000 m to signal that this is not a precise reading —
/// callers can check the `isDefault` flag in the returned map to warn the user.
/// Change [defaultLatitude] and [defaultLongitude] to match the organisation's
/// primary operating area.
class DefaultLocation {
  static const double defaultLatitude = 6.6828;   // Fallback latitude
  static const double defaultLongitude = 80.3992; // Fallback longitude
  static const double defaultAccuracy = 1000.0;   // 1 km radius — means "not precise"
}

/// Provides GPS coordinates without needing an internet connection.
///
/// GPS satellites work offline — this service reads the device's GPS chip directly.
/// If GPS is turned off, permission is denied, or the chip times out, the service
/// falls back to [DefaultLocation] so the rest of the app never crashes.
/// Every method returns a map with `isDefault: true` when the fallback is used.
class OfflineLocationService {
  /// Reads the device's GPS chip and returns the current coordinates.
  ///
  /// The returned map contains: `latitude`, `longitude`, `accuracy` (metres),
  /// `altitude`, `heading`, `speed`, `timestamp` (ms since epoch), `isDefault`.
  ///
  /// Fallback chain — the method uses [DefaultLocation] when:
  ///   1. Location services are switched off in the device settings.
  ///   2. The user has denied location permission (asks once first).
  ///   3. Permission is permanently denied (user chose "Never ask again").
  ///   4. Any other error occurs (e.g. GPS hardware timeout).
  ///
  /// `isDefault: false` means real GPS was used. `isDefault: true` means the
  /// fallback was used — the caller should warn the user the location may be wrong.
  static Future<Map<String, dynamic>> getCurrentLocation() async {
    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('⚠️ Location services disabled. Using default location.');
        return _getDefaultLocation();
      }

      // Check location permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          print('⚠️ Location permissions denied. Using default location.');
          return _getDefaultLocation();
        }
      }

      if (permission == LocationPermission.deniedForever) {
        print('⚠️ Location permissions permanently denied. Using default location.');
        return _getDefaultLocation();
      }

      // Get current position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'heading': position.heading,
        'speed': position.speed,
          'timestamp': position.timestamp.millisecondsSinceEpoch,
        'isDefault': false,
      };
    } catch (e) {
      print('⚠️ Error getting location: $e. Using default location.');
      return _getDefaultLocation();
    }
  }

  /// Returns the most recent GPS reading cached by the operating system.
  ///
  /// This is faster than [getCurrentLocation] because it does not wait for a
  /// fresh satellite fix. It is useful as a quick preview before a live fix
  /// arrives. Returns null if the device has no cached reading at all.
  static Future<Map<String, dynamic>?> getLastKnownLocation() async {
    try {
      Position? position = await Geolocator.getLastKnownPosition();
      
      if (position != null) {
        return {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'altitude': position.altitude,
          'heading': position.heading,
          'speed': position.speed,
          'timestamp': position.timestamp.millisecondsSinceEpoch,
          'isDefault': false,
        };
      }
    } catch (e) {
      print('Error getting last known location: $e');
    }
    
    return null;
  }

  /// Builds the fallback location map using [DefaultLocation] constants.
  /// Sets `isDefault: true` so every caller can detect that real GPS was not used.
  static Map<String, dynamic> _getDefaultLocation() {
    return {
      'latitude': DefaultLocation.defaultLatitude,
      'longitude': DefaultLocation.defaultLongitude,
      'accuracy': DefaultLocation.defaultAccuracy,
      'altitude': null,
      'heading': null,
      'speed': null,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'isDefault': true,
    };
  }

  /// Returns true if the device has location services (GPS) switched on in settings.
  /// Does NOT check whether this app has been granted permission.
  static Future<bool> isLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  /// Shows the system permission dialog asking the user to allow location access.
  /// Returns the resulting [LocationPermission] enum value so the caller can
  /// decide what to do next (e.g. show an explanation dialog if still denied).
  static Future<LocationPermission> requestPermission() async {
    return await Geolocator.requestPermission();
  }
}

