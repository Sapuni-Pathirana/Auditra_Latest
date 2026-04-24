class Valuation {
  final int id;
  final int projectId;
  final String projectTitle;
  final int fieldOfficerId;
  final String fieldOfficerUsername;
  final String? fieldOfficerName;
  final String category;
  final String categoryDisplay;
  final String status;
  final String statusDisplay;
  final String? description;
  final double? estimatedValue;
  final String? notes;
  
  // Land fields
  final double? landArea;
  final String? landType;
  final String? landLocation;
  final double? landLatitude;
  final double? landLongitude;
  
  // Building fields
  final double? buildingArea;
  final String? buildingType;
  final String? buildingLocation;
  final double? buildingLatitude;
  final double? buildingLongitude;
  final int? numberOfFloors;
  final int? yearBuilt;
  
  // Vehicle fields
  final String? vehicleMake;
  final String? vehicleModel;
  final int? vehicleYear;
  final String? vehicleRegistrationNumber;
  final int? vehicleMileage;
  final String? vehicleCondition;
  
  // Other fields
  final String? otherType;
  final String? otherSpecifications;
  
  final List<ValuationPhoto> photos;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? submittedAt;
  final bool canBeEdited;
  final String? rejectionReason;
  final String? accessorComments;
  final String? seniorValuerComments;
  final String? finalReportUrl;

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
  });

  factory Valuation.fromJson(Map<String, dynamic> json) {
    // Safely parse required int fields with null handling
    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) {
        return int.tryParse(value);
      }
      if (value is double) {
        return value.toInt();
      }
      return null;
    }

    // Required fields - handle offline/cached data gracefully
    final id = parseInt(json['id']);
    final projectId = parseInt(json['project']);
    // For offline valuations, field_officer might be missing - use 0 as fallback
    final fieldOfficerId = parseInt(json['field_officer']) ?? 0;

    if (id == null) {
      throw FormatException('Required field "id" is null or cannot be parsed');
    }
    if (projectId == null) {
      throw FormatException('Required field "project" is null or cannot be parsed');
    }
    // Note: field_officer can be 0 for offline valuations that haven't been synced yet

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
      estimatedValue: json['estimated_value'] != null ? double.parse(json['estimated_value'].toString()) : null,
      notes: json['notes'],
      landArea: json['land_area'] != null ? double.parse(json['land_area'].toString()) : null,
      landType: json['land_type'],
      landLocation: json['land_location'],
      landLatitude: json['land_latitude'] != null 
          ? double.parse(double.parse(json['land_latitude'].toString()).toStringAsFixed(6))
          : null,
      landLongitude: json['land_longitude'] != null 
          ? double.parse(double.parse(json['land_longitude'].toString()).toStringAsFixed(6))
          : null,
      buildingArea: json['building_area'] != null ? double.parse(json['building_area'].toString()) : null,
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
          .toList() ?? [],
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
    );
  }

  bool get isDraft => status == 'draft';
  bool get isSubmitted => status == 'submitted';
}

class ValuationPhoto {
  final int id;
  final int valuationId;
  final String? photoUrl;
  final String? caption;
  final DateTime uploadedAt;
  final bool isPrimary;
  final int ordering;
  final DateTime? capturedAt;
  final double? gpsLat;
  final double? gpsLon;
  final String? deviceId;

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

  factory ValuationPhoto.fromJson(Map<String, dynamic> json) {
    int? parseInt(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
      return null;
    }

    double? parseDouble(dynamic value) {
      if (value == null) return null;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value);
      return null;
    }

    final id = parseInt(json['id']);
    final valuationId = parseInt(json['valuation'] ?? json['valuation_id']) ?? 0;

    if (id == null) {
      throw FormatException('Required field "id" is null or cannot be parsed in ValuationPhoto JSON: ${json['id']}');
    }

    return ValuationPhoto(
      id: id,
      valuationId: valuationId,
      photoUrl: json['photo_url'],
      caption: json['caption'],
      uploadedAt: DateTime.parse(json['uploaded_at']),
      isPrimary: json['is_primary'] == true,
      ordering: parseInt(json['ordering']) ?? 0,
      capturedAt: json['captured_at'] != null ? DateTime.tryParse(json['captured_at'].toString()) : null,
      gpsLat: parseDouble(json['gps_lat']),
      gpsLon: parseDouble(json['gps_lon']),
      deviceId: json['device_id']?.toString(),
    );
  }
}

