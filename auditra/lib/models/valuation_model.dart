/// Represents a single valuation report created by a field officer.
///
/// A valuation is an assessment of a property or asset (land, building,
/// vehicle, or other). The field officer fills in the details, submits it,
/// and then an accessor and senior valuer review it.
class Valuation {

  // ─── Core identifiers ────────────────────────────────────────────────────

  /// Unique ID of this valuation record in the database.
  final int id;

  /// ID of the project this valuation belongs to.
  final int projectId;

  /// Human-readable title of the project (e.g. "Land Assessment - Colombo").
  final String projectTitle;

  // ─── Field officer info ───────────────────────────────────────────────────

  /// ID of the field officer who created this valuation.
  final int fieldOfficerId;

  /// Username (login name) of the field officer.
  final String fieldOfficerUsername;

  /// Full name of the field officer (optional — may be null).
  final String? fieldOfficerName;

  // ─── Category ─────────────────────────────────────────────────────────────

  /// Internal category code: "land", "building", "vehicle", or "other".
  final String category;

  /// Display-friendly label for the category (e.g. "Land", "Building").
  final String categoryDisplay;

  // ─── Status ───────────────────────────────────────────────────────────────

  /// Internal status code: "draft", "submitted", "approved", "rejected", etc.
  final String status;

  /// Display-friendly status label shown in the UI (e.g. "Draft", "Submitted").
  final String statusDisplay;

  // ─── General report details ───────────────────────────────────────────────

  /// Free-text description of what is being valued.
  final String? description;

  /// The estimated monetary value in LKR calculated by the field officer.
  final double? estimatedValue;

  /// Additional notes the field officer may want to include.
  final String? notes;

  // ─── Land-specific fields ─────────────────────────────────────────────────
  // These fields are only filled when category == "land".

  /// Size of the land in perches or square metres.
  final double? landArea;

  /// Type of land (e.g. "Residential", "Commercial", "Agricultural").
  final String? landType;

  /// Text description of the land's location.
  final String? landLocation;

  /// GPS latitude of the land (up to 6 decimal places).
  final double? landLatitude;

  /// GPS longitude of the land (up to 6 decimal places).
  final double? landLongitude;

  // ─── Building-specific fields ─────────────────────────────────────────────
  // These fields are only filled when category == "building".

  /// Floor area of the building in square metres.
  final double? buildingArea;

  /// Type of building (e.g. "House", "Office", "Warehouse").
  final String? buildingType;

  /// Text description of the building's location.
  final String? buildingLocation;

  /// GPS latitude of the building (up to 6 decimal places).
  final double? buildingLatitude;

  /// GPS longitude of the building (up to 6 decimal places).
  final double? buildingLongitude;

  /// Total number of floors in the building.
  final int? numberOfFloors;

  /// The year the building was constructed.
  final int? yearBuilt;

  // ─── Vehicle-specific fields ──────────────────────────────────────────────
  // These fields are only filled when category == "vehicle".

  /// Brand/manufacturer of the vehicle (e.g. "Toyota", "Honda").
  final String? vehicleMake;

  /// Model name of the vehicle (e.g. "Corolla", "Civic").
  final String? vehicleModel;

  /// Year the vehicle was manufactured.
  final int? vehicleYear;

  /// The licence plate / registration number of the vehicle.
  final String? vehicleRegistrationNumber;

  /// Total distance the vehicle has travelled, in kilometres.
  final int? vehicleMileage;

  /// Overall condition of the vehicle (e.g. "Good", "Fair", "Poor").
  final String? vehicleCondition;

  // ─── Other asset fields ───────────────────────────────────────────────────
  // These fields are only filled when category == "other".

  /// Short label for what type of asset it is (e.g. "Machinery", "Jewellery").
  final String? otherType;

  /// Detailed technical or descriptive specifications of the asset.
  final String? otherSpecifications;

  // ─── Photos and timestamps ────────────────────────────────────────────────

  /// List of photos attached to this valuation by the field officer.
  final List<ValuationPhoto> photos;

  /// Date and time when this valuation was first created.
  final DateTime createdAt;

  /// Date and time when this valuation was last modified.
  final DateTime updatedAt;

  /// Date and time when the field officer submitted this valuation for review.
  /// Will be null if the report is still a draft.
  final DateTime? submittedAt;

  // ─── Review and approval fields ───────────────────────────────────────────

  /// Whether the field officer is still allowed to edit this valuation.
  /// True only when the report is in "draft" or "rejected" state.
  final bool canBeEdited;

  /// If the accessor rejected this report, the reason they gave is stored here.
  final String? rejectionReason;

  /// Comments added by the accessor (the person who does the first review).
  final String? accessorComments;

  /// Comments added by the senior valuer (the final decision-maker).
  final String? seniorValuerComments;

  // ─── PDF report URLs ──────────────────────────────────────────────────────

  /// URL to the final signed PDF report produced by the senior valuer.
  final String? finalReportUrl;

  /// URL to the PDF report uploaded by the field officer when submitting.
  final String? submittedReportUrl;

  // ─── Constructor ──────────────────────────────────────────────────────────

  /// Creates a Valuation object by passing all its fields directly.
  /// This is used internally — most code uses [Valuation.fromJson] instead.
  Valuation({
    required this.id,
    required this.projectId,
    required this.projectTitle,
    required this.fieldOfficerId,
    required this.fieldOfficerUsername,
    this.fieldOfficerName,
    required this.category,
    required this.categoryDisplay,
    required this.status,
    required this.statusDisplay,
    this.description,
    this.estimatedValue,
    this.notes,
    this.landArea,
    this.landType,
    this.landLocation,
    this.landLatitude,
    this.landLongitude,
    this.buildingArea,
    this.buildingType,
    this.buildingLocation,
    this.buildingLatitude,
    this.buildingLongitude,
    this.numberOfFloors,
    this.yearBuilt,
    this.vehicleMake,
    this.vehicleModel,
    this.vehicleYear,
    this.vehicleRegistrationNumber,
    this.vehicleMileage,
    this.vehicleCondition,
    this.otherType,
    this.otherSpecifications,
    required this.photos,
    required this.createdAt,
    required this.updatedAt,
    this.submittedAt,
    this.canBeEdited = false,
    this.rejectionReason,
    this.accessorComments,
    this.seniorValuerComments,
    this.finalReportUrl,
    this.submittedReportUrl,
  });

  // ─── fromJson factory ─────────────────────────────────────────────────────

  /// Creates a [Valuation] object from a JSON map received from the backend API.
  ///
  /// This is the main way a Valuation is created in the app. The backend sends
  /// data as JSON text, and this function reads each field and converts it to
  /// the correct Dart type (int, double, DateTime, etc.).
  factory Valuation.fromJson(Map<String, dynamic> json) {

    // Helper: safely convert any value to an integer.
    // Handles cases where the API sends a number as a string (e.g. "5" instead of 5).
    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
      return null;
    }

    // Read the three most critical fields first so we can validate them.
    final id = parseInt(json['id']);
    final projectId = parseInt(json['project']);

    // field_officer may be missing for valuations saved while offline —
    // default to 0 so the rest of the app does not crash.
    final fieldOfficerId = parseInt(json['field_officer']) ?? 0;

    // These two fields MUST exist — if they are missing, the data is invalid.
    if (id == null) {
      throw FormatException('Required field "id" is null or cannot be parsed');
    }
    if (projectId == null) {
      throw FormatException('Required field "project" is null or cannot be parsed');
    }

    // Build and return the fully populated Valuation object.
    return Valuation(
      id: id,
      projectId: projectId,
      projectTitle: (json['project_title'] as String?) ?? '',
      fieldOfficerId: fieldOfficerId,
      fieldOfficerUsername: (json['field_officer_username'] as String?) ?? '',
      fieldOfficerName: json['field_officer_name'] as String?,
      category: (json['category'] as String?) ?? 'unknown',
      categoryDisplay: (json['category_display'] as String?) ?? (json['category'] as String?) ?? 'Unknown',
      status: (json['status'] as String?) ?? 'draft',
      statusDisplay: (json['status_display'] as String?) ?? 'Draft',
      description: json['description'],
      estimatedValue: json['estimated_value'] != null
          ? double.parse(json['estimated_value'].toString())
          : null,
      notes: json['notes'],
      landArea: json['land_area'] != null
          ? double.parse(json['land_area'].toString())
          : null,
      landType: json['land_type'],
      landLocation: json['land_location'],
      // GPS coordinates are rounded to 6 decimal places to avoid floating-point noise.
      landLatitude: json['land_latitude'] != null
          ? double.parse(double.parse(json['land_latitude'].toString()).toStringAsFixed(6))
          : null,
      landLongitude: json['land_longitude'] != null
          ? double.parse(double.parse(json['land_longitude'].toString()).toStringAsFixed(6))
          : null,
      buildingArea: json['building_area'] != null
          ? double.parse(json['building_area'].toString())
          : null,
      buildingType: json['building_type'],
      buildingLocation: json['building_location'],
      buildingLatitude: json['building_latitude'] != null
          ? double.parse(double.parse(json['building_latitude'].toString()).toStringAsFixed(6))
          : null,
      buildingLongitude: json['building_longitude'] != null
          ? double.parse(double.parse(json['building_longitude'].toString()).toStringAsFixed(6))
          : null,
      numberOfFloors: parseInt(json['number_of_floors']),
      yearBuilt: parseInt(json['year_built']),
      vehicleMake: json['vehicle_make'],
      vehicleModel: json['vehicle_model'],
      vehicleYear: parseInt(json['vehicle_year']),
      vehicleRegistrationNumber: json['vehicle_registration_number'],
      vehicleMileage: parseInt(json['vehicle_mileage']),
      vehicleCondition: json['vehicle_condition'],
      otherType: json['other_type'],
      otherSpecifications: json['other_specifications'],
      // Parse each photo in the list individually.
      // If one photo fails to parse, it is skipped rather than crashing the whole report.
      photos: (json['photos'] as List<dynamic>?)
              ?.map((photo) {
                try {
                  return ValuationPhoto.fromJson(photo);
                } catch (e) {
                  print('Warning: Failed to parse valuation photo: $e');
                  return null;
                }
              })
              .whereType<ValuationPhoto>()
              .toList() ??
          [],
      // Use current time as a fallback if timestamps are missing (e.g. offline data).
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'].toString())
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'].toString())
          : DateTime.now(),
      submittedAt: json['submitted_at'] != null
          ? DateTime.parse(json['submitted_at'].toString())
          : null,
      canBeEdited: json['can_be_edited'] ?? false,
      rejectionReason: json['rejection_reason'] as String?,
      accessorComments: json['accessor_comments'] as String?,
      seniorValuerComments: json['senior_valuer_comments'] as String?,
      finalReportUrl: json['final_report_url'] as String?,
      submittedReportUrl: json['submitted_report_url'] as String?,
    );
  }

  // ─── Convenience getters ──────────────────────────────────────────────────

  /// Returns true if the report has not been submitted yet (still being edited).
  bool get isDraft => status == 'draft';

  /// Returns true if the report has been submitted and is awaiting review.
  bool get isSubmitted => status == 'submitted';
}

// ─────────────────────────────────────────────────────────────────────────────

/// Represents a single photo attached to a valuation report.
///
/// Field officers can take multiple photos of the asset being valued.
/// Each photo can have a caption, GPS coordinates, and a timestamp
/// showing when it was captured.
class ValuationPhoto {

  /// Unique ID of this photo record in the database.
  final int id;

  /// ID of the valuation report this photo belongs to.
  final int valuationId;

  /// URL to download or display the photo (hosted on the server).
  final String? photoUrl;

  /// Short description of what the photo shows (e.g. "Front view").
  final String? caption;

  /// Date and time when this photo was uploaded to the server.
  final DateTime uploadedAt;

  /// True if this is the main/cover photo for the valuation.
  final bool isPrimary;

  /// Number used to control the display order of photos (lower = shown first).
  final int ordering;

  /// The actual date and time the photo was taken by the device camera.
  final DateTime? capturedAt;

  /// GPS latitude recorded at the moment the photo was taken.
  final double? gpsLat;

  /// GPS longitude recorded at the moment the photo was taken.
  final double? gpsLon;

  /// Unique identifier of the device used to capture the photo.
  final String? deviceId;

  // ─── Constructor ──────────────────────────────────────────────────────────

  /// Creates a ValuationPhoto object directly from its fields.
  ValuationPhoto({
    required this.id,
    required this.valuationId,
    this.photoUrl,
    this.caption,
    required this.uploadedAt,
    this.isPrimary = false,
    this.ordering = 0,
    this.capturedAt,
    this.gpsLat,
    this.gpsLon,
    this.deviceId,
  });

  // ─── fromJson factory ─────────────────────────────────────────────────────

  /// Creates a [ValuationPhoto] from a JSON map returned by the backend API.
  ///
  /// Handles type mismatches (e.g. numbers sent as strings) using the
  /// helper functions below.
  factory ValuationPhoto.fromJson(Map<String, dynamic> json) {

    // Helper: safely convert any value to an integer.
    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
      return null;
    }

    // Helper: safely convert any value to a decimal number.
    double? parseDouble(dynamic value) {
      if (value == null) return null;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value);
      return null;
    }

    final id = parseInt(json['id']);

    // The backend may send the valuation link as either "valuation" or "valuation_id".
    final valuationId = parseInt(json['valuation'] ?? json['valuation_id']) ?? 0;

    // Photo ID is required — throw a clear error if it is missing.
    if (id == null) {
      throw FormatException(
          'Required field "id" is null or cannot be parsed in ValuationPhoto JSON: ${json['id']}');
    }

    return ValuationPhoto(
      id: id,
      valuationId: valuationId,
      photoUrl: json['photo_url'],
      caption: json['caption'],
      uploadedAt: DateTime.parse(json['uploaded_at']),
      isPrimary: json['is_primary'] == true,
      ordering: parseInt(json['ordering']) ?? 0,
      capturedAt: json['captured_at'] != null
          ? DateTime.tryParse(json['captured_at'].toString())
          : null,
      gpsLat: parseDouble(json['gps_lat']),
      gpsLon: parseDouble(json['gps_lon']),
      deviceId: json['device_id']?.toString(),
    );
  }
}

