import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'dart:io';
import 'dart:math' as math;
import '../services/api_service.dart';
import '../services/network_service.dart';
import '../services/offline_db_service.dart';
import '../services/offline_storage_service.dart';
import '../services/pdf_service.dart';
import '../models/project_model.dart';
import '../models/valuation_model.dart';
import '../widgets/item_suggestions_widget.dart';
import '../widgets/depreciation_widget.dart';

class ValuationFormScreen extends StatefulWidget {
  final Project project;
  final Valuation? existingValuation;

  const ValuationFormScreen({
    super.key,
    required this.project,
    this.existingValuation,
  });

  @override
  State<ValuationFormScreen> createState() => _ValuationFormScreenState();
}

class _ValuationFormScreenState extends State<ValuationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();
  
  String _category = 'land';
  bool _isLoading = false;
  bool _isSubmitting = false;
  
  // Common fields
  final _descriptionController = TextEditingController();
  final _estimatedValueController = TextEditingController();
  final _notesController = TextEditingController();
  
  // Appreciation/Depreciation calculation fields
  String? _calculationType; // 'appreciation' or 'depreciation'
  String? _calculationMethod; // selected method under type
  final _rateController = TextEditingController();
  final _yearsController = TextEditingController();
  final _newPriceController = TextEditingController();
  bool _showNewPriceField = false; // Track if calculation has been done
  
  // Land fields
  final _landAreaController = TextEditingController();
  final _landTypeController = TextEditingController();
  final _landLocationController = TextEditingController();
  double? _landLatitude;
  double? _landLongitude;
  
  // Building fields
  final _buildingAreaController = TextEditingController();
  final _buildingTypeController = TextEditingController();
  final _buildingLocationController = TextEditingController();
  final _numberOfFloorsController = TextEditingController();
  final _yearBuiltController = TextEditingController();
  double? _buildingLatitude;
  double? _buildingLongitude;
  
  // Vehicle fields
  final _vehicleMakeController = TextEditingController();
  final _vehicleModelController = TextEditingController();
  final _vehicleYearController = TextEditingController();
  final _vehicleRegistrationController = TextEditingController();
  final _vehicleMileageController = TextEditingController();
  final _vehicleConditionController = TextEditingController();
  
  // Other fields
  final _otherTypeController = TextEditingController();
  final _otherSpecificationsController = TextEditingController();
  
  List<File> _selectedPhotos = [];
  // Feature #9: parallel metadata list — same index as _selectedPhotos
  final List<Map<String, dynamic>> _photoMeta = [];
  int _primaryPhotoIndex = 0;
  List<ValuationPhoto> _existingPhotos = [];
  int? _valuationId;

  // Feature #10: item suggestion panel state
  bool _showSuggestions = false;
  String _lastSuggestionQuery = '';
  // Feature #12: depreciation override state (set by DepreciationWidget)
  Map<String, dynamic>? _depreciationResult;

  static const Map<String, String> _calculationMethodLabels = {
    'simple_interest': 'Simple Interest',
    'compound_annual': 'Compound (Annual)',
    'compound_monthly': 'Compound (Monthly)',
    'straight_line': 'Straight Line',
    'reducing_balance': 'Reducing Balance',
    'double_declining': 'Double Declining',
  };

  List<String> get _availableMethods {
    if (_calculationType == 'appreciation') {
      return const ['simple_interest', 'compound_annual', 'compound_monthly'];
    }
    if (_calculationType == 'depreciation') {
      return const ['straight_line', 'reducing_balance', 'double_declining'];
    }
    return const [];
  }

  @override
  void initState() {
    super.initState();
    if (widget.existingValuation != null) {
      _loadExistingValuation(widget.existingValuation!);
    } else {
      // Automatically detect location for new valuations (land and building only)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_category == 'land' || _category == 'building') {
          _getCurrentLocation();
        }
      });
    }
  }

  void _loadExistingValuation(Valuation valuation) {
    setState(() {
      _valuationId = valuation.id;
      _category = valuation.category;
      _descriptionController.text = valuation.description ?? '';
      
      // Extract calculation information from notes if available
      String? notes = valuation.notes;
      String? baseValueStr;
      String? adjustmentType;
      String? methodStr;
      String? rateStr;
      String? yearsStr;
      String? calculatedValueStr;
      
      if (notes != null && notes.isNotEmpty) {
        // Look for structured calculation block
        final calculationBlockRegex = RegExp(
          r'\[VALUATION_CALCULATION\](.*?)\[/VALUATION_CALCULATION\]',
          dotAll: true,
          caseSensitive: false,
        );
        final calculationMatch = calculationBlockRegex.firstMatch(notes);
        
        if (calculationMatch != null) {
          final calculationData = calculationMatch.group(1) ?? '';
          
          // Extract Base Value
          final baseValueRegex = RegExp(r'Base Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
          final baseMatch = baseValueRegex.firstMatch(calculationData);
          if (baseMatch != null) {
            baseValueStr = baseMatch.group(1)?.replaceAll(',', '');
          }
          
          // Extract Adjustment Type
          final typeRegex = RegExp(r'Adjustment Type:\s*(Appreciation|Depreciation|None)', caseSensitive: false);
          final typeMatch = typeRegex.firstMatch(calculationData);
          if (typeMatch != null) {
            final type = typeMatch.group(1);
            if (type != null && type != 'None') {
              adjustmentType = type.toLowerCase();
            }
          }
          
          // Extract Rate
          final methodRegex = RegExp(r'Method:\s*([A-Za-z _()-]+)', caseSensitive: false);
          final methodMatch = methodRegex.firstMatch(calculationData);
          if (methodMatch != null) {
            final raw = (methodMatch.group(1) ?? '').trim().toLowerCase();
            final slug = raw
                .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
                .replaceAll(RegExp(r'_+'), '_')
                .replaceAll(RegExp(r'^_|_$'), '');
            if (slug.isNotEmpty) {
              methodStr = slug;
            }
          }

          // Extract Rate
          final rateRegex = RegExp(r'Rate:\s*([\d,]+\.?\d*)\s*%', caseSensitive: false);
          final rateMatch = rateRegex.firstMatch(calculationData);
          if (rateMatch != null) {
            rateStr = rateMatch.group(1)?.replaceAll(',', '');
          }
          
          // Extract Years
          final yearsRegex = RegExp(r'Years:\s*(\d+)', caseSensitive: false);
          final yearsMatch = yearsRegex.firstMatch(calculationData);
          if (yearsMatch != null) {
            yearsStr = yearsMatch.group(1);
          }
          
          // Extract Calculated Value
          final calculatedRegex = RegExp(r'Calculated Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
          final calculatedMatch = calculatedRegex.firstMatch(calculationData);
          if (calculatedMatch != null) {
            calculatedValueStr = calculatedMatch.group(1)?.replaceAll(',', '');
          }
          
          // Remove calculation block from notes for display (to avoid duplication)
          notes = notes.replaceAll(
            RegExp(r'\[VALUATION_CALCULATION\].*?\[/VALUATION_CALCULATION\]', dotAll: true, caseSensitive: false),
            '',
          ).trim();
        }
      }
      
      // Set base value field (prefer extracted base value, otherwise use estimated value)
      _estimatedValueController.text = baseValueStr ?? valuation.estimatedValue?.toString() ?? '';
      
      // Set notes (without calculation block)
      _notesController.text = notes ?? '';
      
      // Populate calculation fields if available
      if (adjustmentType != null) {
        _calculationType = adjustmentType;
        _calculationMethod = adjustmentType == 'appreciation'
            ? 'compound_annual'
            : 'reducing_balance';
      }
      if (methodStr != null && _availableMethods.contains(methodStr)) {
        _calculationMethod = methodStr;
      }
      if (rateStr != null) {
        _rateController.text = rateStr;
      }
      if (yearsStr != null) {
        _yearsController.text = yearsStr;
      }
      if (calculatedValueStr != null) {
        _newPriceController.text = calculatedValueStr;
        _showNewPriceField = true;
      }
      
      // Land fields
      _landAreaController.text = valuation.landArea?.toString() ?? '';
      _landTypeController.text = valuation.landType ?? '';
      _landLocationController.text = valuation.landLocation ?? '';
      // Round to 6 decimal places when loading
      if (valuation.landLatitude != null) {
        _landLatitude = double.parse(valuation.landLatitude!.toStringAsFixed(6));
      }
      if (valuation.landLongitude != null) {
        _landLongitude = double.parse(valuation.landLongitude!.toStringAsFixed(6));
      }
      // Update location text if coordinates exist
      if (_landLatitude != null && _landLongitude != null) {
        _landLocationController.text = '$_landLatitude, $_landLongitude';
      }
      
      // Building fields
      _buildingAreaController.text = valuation.buildingArea?.toString() ?? '';
      _buildingTypeController.text = valuation.buildingType ?? '';
      _buildingLocationController.text = valuation.buildingLocation ?? '';
      _numberOfFloorsController.text = valuation.numberOfFloors?.toString() ?? '';
      _yearBuiltController.text = valuation.yearBuilt?.toString() ?? '';
      // Round to 6 decimal places when loading
      if (valuation.buildingLatitude != null) {
        _buildingLatitude = double.parse(valuation.buildingLatitude!.toStringAsFixed(6));
      }
      if (valuation.buildingLongitude != null) {
        _buildingLongitude = double.parse(valuation.buildingLongitude!.toStringAsFixed(6));
      }
      // Update location text if coordinates exist
      if (_buildingLatitude != null && _buildingLongitude != null) {
        _buildingLocationController.text = '$_buildingLatitude, $_buildingLongitude';
      }
      
      // Vehicle fields
      _vehicleMakeController.text = valuation.vehicleMake ?? '';
      _vehicleModelController.text = valuation.vehicleModel ?? '';
      _vehicleYearController.text = valuation.vehicleYear?.toString() ?? '';
      _vehicleRegistrationController.text = valuation.vehicleRegistrationNumber ?? '';
      _vehicleMileageController.text = valuation.vehicleMileage?.toString() ?? '';
      _vehicleConditionController.text = valuation.vehicleCondition ?? '';
      
      // Other fields
      _otherTypeController.text = valuation.otherType ?? '';
      _otherSpecificationsController.text = valuation.otherSpecifications ?? '';
      
      _existingPhotos = valuation.photos;
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _estimatedValueController.dispose();
    _notesController.dispose();
    _landAreaController.dispose();
    _landTypeController.dispose();
    _landLocationController.dispose();
    _buildingAreaController.dispose();
    _buildingTypeController.dispose();
    _buildingLocationController.dispose();
    _numberOfFloorsController.dispose();
    _yearBuiltController.dispose();
    _vehicleMakeController.dispose();
    _vehicleModelController.dispose();
    _vehicleYearController.dispose();
    _vehicleRegistrationController.dispose();
    _vehicleMileageController.dispose();
    _vehicleConditionController.dispose();
    _otherTypeController.dispose();
    _otherSpecificationsController.dispose();
    _rateController.dispose();
    _yearsController.dispose();
    _newPriceController.dispose();
    super.dispose();
  }

  /// Feature #9: compress image and return the compressed file.
  Future<File?> _compressImage(File original) async {
    final targetPath = '${original.path}_compressed.jpg';
    final result = await FlutterImageCompress.compressAndGetFile(
      original.absolute.path,
      targetPath,
      quality: 75,
      minWidth: 1280,
      minHeight: 720,
    );
    return result != null ? File(result.path) : original;
  }

  /// Feature #9: get device identifier
  Future<String> _getDeviceId() async {
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final android = await info.androidInfo;
        return android.id;
      } else if (Platform.isIOS) {
        final ios = await info.iosInfo;
        return ios.identifierForVendor ?? 'unknown';
      }
    } catch (_) {}
    return 'unknown';
  }

  /// Feature #9: capture per-photo metadata (gps, timestamp, device_id).
  Future<Map<String, dynamic>> _capturePhotoMeta() async {
    final meta = <String, dynamic>{
      'captured_at': DateTime.now().toIso8601String(),
      'device_id': await _getDeviceId(),
    };
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      ).timeout(const Duration(seconds: 8));
      meta['gps_lat'] = pos.latitude;
      meta['gps_lon'] = pos.longitude;
    } catch (_) {}
    return meta;
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        final compressed = await _compressImage(File(image.path)) ?? File(image.path);
        final meta = await _capturePhotoMeta();
        setState(() {
          _selectedPhotos.add(compressed);
          _photoMeta.add(meta);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error picking image: $e')));
      }
    }
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.camera);
      if (image != null) {
        final compressed = await _compressImage(File(image.path)) ?? File(image.path);
        final meta = await _capturePhotoMeta();
        setState(() {
          _selectedPhotos.add(compressed);
          _photoMeta.add(meta);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error taking photo: $e')));
      }
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location services are disabled.')),
          );
        }
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Location permissions are denied.')),
            );
          }
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permissions are permanently denied.')),
          );
        }
        return;
      }

      setState(() => _isLoading = true);

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Round to 6 decimal places to match backend DecimalField(max_digits=9, decimal_places=6)
      final roundedLat = double.parse(position.latitude.toStringAsFixed(6));
      final roundedLng = double.parse(position.longitude.toStringAsFixed(6));
      
      final locationText = '$roundedLat, $roundedLng';

      setState(() {
        if (_category == 'land') {
          _landLatitude = roundedLat;
          _landLongitude = roundedLng;
          _landLocationController.text = locationText;
        } else if (_category == 'building') {
          _buildingLatitude = roundedLat;
          _buildingLongitude = roundedLng;
          _buildingLocationController.text = locationText;
        }
        _isLoading = false;
      });
      
      // Trigger rebuild to show Google Maps link
      if (mounted) {
        setState(() {});
      }

      // Location captured silently - no snackbar needed for automatic detection
      // The location field will be updated automatically
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error getting location: $e')),
        );
      }
    }
  }

  Future<void> _saveValuation() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Helper function to clean empty strings to null
      String? cleanString(String? value) {
        if (value == null || value.trim().isEmpty) return null;
        return value.trim();
      }

      // Feature #9: capture once at save-time to stamp photos uploaded below
      final deviceId = await _getDeviceId();
      final capturedAt = DateTime.now().toIso8601String();
      Map<String, dynamic> data = {
        'project': widget.project.id,
        'category': _category,
      };

      // Add common fields (only if not empty)
      final description = cleanString(_descriptionController.text);
      if (description != null) data['description'] = description;

      // Always get base value first (the original value entered by user)
      String? baseValueStr;
      double? baseValue;
      if (_estimatedValueController.text.isNotEmpty) {
        baseValueStr = _estimatedValueController.text;
        baseValue = double.tryParse(baseValueStr);
      }

      // Use new price if calculated, otherwise use base value as estimated value
      if (_showNewPriceField && _newPriceController.text.isNotEmpty) {
        final newPrice = double.tryParse(_newPriceController.text);
        if (newPrice != null) {
          // Save calculated value as estimated_value
          data['estimated_value'] = newPrice;
        }
      } else if (baseValue != null) {
        // No calculation done, save base value as estimated_value
        data['estimated_value'] = baseValue;
      }

      // Build notes with base value and calculation information
      String? notes = cleanString(_notesController.text);
      
      // Always store base value information
      if (baseValueStr != null) {
        String calculationInfo = '';
        
        // If calculation was performed, include all calculation details
        if (_showNewPriceField && _calculationType != null && _rateController.text.isNotEmpty && _yearsController.text.isNotEmpty && _newPriceController.text.isNotEmpty) {
          final methodLabel = _calculationMethodLabels[_calculationMethod] ??
              (_calculationType == 'appreciation'
                  ? _calculationMethodLabels['compound_annual']!
                  : _calculationMethodLabels['reducing_balance']!);
          calculationInfo = '\n\n[VALUATION_CALCULATION]\n'
              'Base Value: LKR $baseValueStr\n'
              'Adjustment Type: ${_calculationType == 'appreciation' ? 'Appreciation' : 'Depreciation'}\n'
              'Method: $methodLabel\n'
              'Rate: ${_rateController.text}%\n'
              'Years: ${_yearsController.text}\n'
              'Calculated Value: LKR ${_newPriceController.text}\n'
              '[/VALUATION_CALCULATION]';
        } else {
          // No calculation, but still store base value for reference
          calculationInfo = '\n\n[VALUATION_CALCULATION]\n'
              'Base Value: LKR $baseValueStr\n'
              'Adjustment Type: None\n'
              'Rate: N/A\n'
              'Years: N/A\n'
              'Calculated Value: N/A\n'
              '[/VALUATION_CALCULATION]';
        }
        
        // Remove existing calculation block if present, then append new one
        if (notes != null) {
          notes = notes.replaceAll(
            RegExp(r'\[VALUATION_CALCULATION\].*?\[/VALUATION_CALCULATION\]', dotAll: true, caseSensitive: false),
            '',
          ).trim();
        }
        notes = notes != null && notes.isNotEmpty ? '$notes$calculationInfo' : calculationInfo;
      }

      // Feature #12: append computed depreciation snapshot to notes for audit
      if (_depreciationResult != null) {
        final d = _depreciationResult!;
        final depBlock = '\n\n[DEPRECIATION]\n'
            'Method: ${d['method'] ?? ''}\n'
            'Book Value: ${d['computed_book_value'] ?? ''}\n'
            'Depreciation Amount: ${d['depreciation_amount'] ?? ''}\n'
            'Applied Rate: ${d['applied_rate'] ?? ''}\n'
            'Override Reason: ${d['override_reason'] ?? ''}\n'
            '[/DEPRECIATION]';
        if (notes != null) {
          notes = notes.replaceAll(
            RegExp(r'\[DEPRECIATION\].*?\[/DEPRECIATION\]', dotAll: true, caseSensitive: false),
            '',
          ).trim();
          notes = '$notes$depBlock';
        } else {
          notes = depBlock;
        }
      }

      if (notes != null) data['notes'] = notes;

      // Add category-specific fields
      if (_category == 'land') {
        if (_landAreaController.text.isNotEmpty) {
          final landArea = double.tryParse(_landAreaController.text);
          if (landArea != null) data['land_area'] = landArea;
        }
        final landType = cleanString(_landTypeController.text);
        if (landType != null) data['land_type'] = landType;
        final landLocation = cleanString(_landLocationController.text);
        if (landLocation != null) data['land_location'] = landLocation;
        if (_landLatitude != null) {
          // Ensure exactly 6 decimal places
          data['land_latitude'] = double.parse(_landLatitude!.toStringAsFixed(6));
        }
        if (_landLongitude != null) {
          // Ensure exactly 6 decimal places
          data['land_longitude'] = double.parse(_landLongitude!.toStringAsFixed(6));
        }
      } else if (_category == 'building') {
        if (_buildingAreaController.text.isNotEmpty) {
          final buildingArea = double.tryParse(_buildingAreaController.text);
          if (buildingArea != null) data['building_area'] = buildingArea;
        }
        final buildingType = cleanString(_buildingTypeController.text);
        if (buildingType != null) data['building_type'] = buildingType;
        final buildingLocation = cleanString(_buildingLocationController.text);
        if (buildingLocation != null) data['building_location'] = buildingLocation;
        if (_buildingLatitude != null) {
          // Ensure exactly 6 decimal places
          data['building_latitude'] = double.parse(_buildingLatitude!.toStringAsFixed(6));
        }
        if (_buildingLongitude != null) {
          // Ensure exactly 6 decimal places
          data['building_longitude'] = double.parse(_buildingLongitude!.toStringAsFixed(6));
        }
        if (_numberOfFloorsController.text.isNotEmpty) {
          final floors = int.tryParse(_numberOfFloorsController.text);
          if (floors != null) data['number_of_floors'] = floors;
        }
        if (_yearBuiltController.text.isNotEmpty) {
          final year = int.tryParse(_yearBuiltController.text);
          if (year != null) data['year_built'] = year;
        }
      } else if (_category == 'vehicle') {
        final vehicleMake = cleanString(_vehicleMakeController.text);
        if (vehicleMake != null) data['vehicle_make'] = vehicleMake;
        final vehicleModel = cleanString(_vehicleModelController.text);
        if (vehicleModel != null) data['vehicle_model'] = vehicleModel;
        if (_vehicleYearController.text.isNotEmpty) {
          final year = int.tryParse(_vehicleYearController.text);
          if (year != null) data['vehicle_year'] = year;
        }
        final regNumber = cleanString(_vehicleRegistrationController.text);
        if (regNumber != null) data['vehicle_registration_number'] = regNumber;
        if (_vehicleMileageController.text.isNotEmpty) {
          final mileage = int.tryParse(_vehicleMileageController.text);
          if (mileage != null) data['vehicle_mileage'] = mileage;
        }
        final condition = cleanString(_vehicleConditionController.text);
        if (condition != null) data['vehicle_condition'] = condition;
      } else if (_category == 'other') {
        final otherType = cleanString(_otherTypeController.text);
        if (otherType != null) data['other_type'] = otherType;
        final otherSpecs = cleanString(_otherSpecificationsController.text);
        if (otherSpecs != null) data['other_specifications'] = otherSpecs;
      }

      // Debug: Print data being sent
      print('Sending valuation data: $data');

      Map<String, dynamic> result;
      if (_valuationId != null) {
        result = await ApiService.updateValuation(_valuationId!, data);
      } else {
        result = await ApiService.createValuation(data);
      }

      if (result['success']) {
        final valuationData = result['data'];
        // Feature #4 fix: 'synced' key now explicitly returned by createValuation
        final synced = result['synced'] ?? true;
        
        // Show offline indicator if saved offline
        if (!synced && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('💾 Valuation saved offline. Will sync when connection is restored.'),
              backgroundColor: Colors.orange,
              duration: const Duration(seconds: 4),
            ),
          );
          
          // If saved offline, automatically close the form
          if (mounted) {
            Navigator.of(context).pop(true);
          }
          return;
        }
        
        // Debug: Print the response data
        print('Valuation creation response: $valuationData');
        print('Response type: ${valuationData.runtimeType}');
        
        // Safely get the valuation ID
        int? newValuationId;
        
        try {
          if (valuationData != null && valuationData is Map<String, dynamic>) {
            final idValue = valuationData['id'];
            print('ID value: $idValue, type: ${idValue?.runtimeType}');
            
            if (idValue != null) {
              if (idValue is int) {
                newValuationId = idValue;
              } else if (idValue is String) {
                newValuationId = int.tryParse(idValue);
              } else if (idValue is double) {
                newValuationId = idValue.toInt();
              } else if (idValue is num) {
                newValuationId = idValue.toInt();
              }
            } else {
              // ID not in response - this can happen if backend returns different format
              // We'll use the existing valuation ID or fetch it later
              print('Note: ID field not found in response. Response keys: ${valuationData.keys.toList()}');
            }
          } else if (valuationData is int) {
            // If the response is just an ID
            newValuationId = valuationData;
          }
        } catch (e) {
          print('Error parsing valuation ID: $e');
        }
        
        // Fallback to existing ID if new ID is null
        newValuationId ??= _valuationId;
        
        if (newValuationId == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('Error: Could not get valuation ID from response. The valuation may have been created but we cannot proceed with photos. Please refresh and try again.'),
                backgroundColor: Colors.orange,
                duration: const Duration(seconds: 7),
                action: SnackBarAction(
                  label: 'Details',
                  textColor: Colors.white,
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Response Details'),
                        content: SingleChildScrollView(
                          child: Text('Response: $valuationData'),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Close'),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            );
          }
          // Don't return - still show success message but warn about photos
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Valuation saved, but ID not received. Photos may not upload.'),
                backgroundColor: Colors.orange,
              ),
            );
            Navigator.of(context).pop(true);
          }
          return;
        }
        
        print('Using valuation ID: $newValuationId');
        
        // Upload photos with metadata (Feature #9)
        for (var i = 0; i < _selectedPhotos.length; i++) {
          final photo = _selectedPhotos[i];
          final meta = i < _photoMeta.length ? _photoMeta[i] : <String, dynamic>{};
          try {
            await ApiService.uploadValuationPhoto(
              newValuationId,
              photo.path,
              isPrimary: i == _primaryPhotoIndex,
              ordering: i,
              capturedAt: (meta['captured_at'] as String?) ?? capturedAt,
              gpsLat: meta['gps_lat'] is num ? (meta['gps_lat'] as num).toDouble() : null,
              gpsLon: meta['gps_lon'] is num ? (meta['gps_lon'] as num).toDouble() : null,
              deviceId: (meta['device_id'] as String?) ?? deviceId,
            );
          } catch (e) {
            print('Error uploading photo: $e');
          }
        }

        // Show success message and close form
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Valuation saved successfully!'),
              backgroundColor: const Color(0xFF84BCDA),
            ),
          );
          Navigator.of(context).pop(true);
        }
      } else {
        if (mounted) {
          // Show detailed error message
          final errorMsg = result['message'] ?? 'Failed to save valuation';
          print('Valuation save error: $errorMsg');
          print('Full result: $result');
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMsg),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 5),
              action: SnackBarAction(
                label: 'Details',
                textColor: Colors.white,
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Error Details'),
                      content: SingleChildScrollView(
                        child: Text(errorMsg),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Close'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          );
        }
      }
    } catch (e, stackTrace) {
      print('Exception in _saveValuation: $e');
      print('Stack trace: $stackTrace');
      if (mounted) {
        String errorMessage = 'Error: $e';
        if (e.toString().contains('Null') && e.toString().contains('int')) {
          errorMessage = 'Server response is missing required data. Please try again or contact support.';
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Details',
              textColor: Colors.white,
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Error Details'),
                    content: SingleChildScrollView(
                      child: Text('$e\n\n$stackTrace'),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Close'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _submitValuation() async {
    if (_valuationId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Report'),
        content: const Text(
          'Are you sure you want to submit this report to the accessor? '
          'Once submitted, it can only be edited for 2 hours.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.blue[700]),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSubmitting = true);

    try {
      // Offline fallback: queue submission and auto-sync when online again.
      final offlineModeEnabled = await OfflineDBService.isOfflineModeEnabled();
      if (offlineModeEnabled) {
        if (!NetworkService.isInitialized) {
          await NetworkService.init();
        }
        final isOnline = await NetworkService.checkConnectivity();
        if (!isOnline) {
          await OfflineStorageService.queueValuationSubmissionOffline(
            valuationId: _valuationId!,
            projectId: widget.project.id,
            projectTitle: widget.project.title,
          );
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('No internet. Report submission queued and will auto-submit when online.'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 4),
              ),
            );
            Navigator.of(context).pop(true);
          }
          return;
        }
      }

      // Fetch the latest valuation data to generate the PDF
      final valResult = await ApiService.getValuation(_valuationId!);
      if (valResult['success'] && valResult['data'] != null) {
        final valuation = Valuation.fromJson(valResult['data']);

        // Generate the PDF report
        final pdfFile = await PdfService.generateValuationReport(
          valuation: valuation,
          project: widget.project,
        );

        // Upload the PDF report to the server
        await ApiService.uploadSubmittedReport(_valuationId!, pdfFile.path);
      }

      // Submit the valuation
      final result = await ApiService.submitValuation(_valuationId!);
      if (result['success']) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Report submitted successfully!'),
              backgroundColor: Color(0xFF84BCDA),
            ),
          );
          Navigator.of(context).pop(true);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Failed to submit report'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
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
        await OfflineStorageService.queueValuationSubmissionOffline(
          valuationId: _valuationId!,
          projectId: widget.project.id,
          projectTitle: widget.project.title,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Network lost. Report submission queued and will auto-submit when online.'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 4),
            ),
          );
          Navigator.of(context).pop(true);
        }
        return;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _deletePhoto(ValuationPhoto photo) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Photo'),
        content: const Text('Are you sure you want to delete this photo?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final result = await ApiService.deleteValuationPhoto(photo.id);
      if (result['success']) {
        setState(() {
          _existingPhotos.removeWhere((p) => p.id == photo.id);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Photo deleted successfully')),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['message'] ?? 'Failed to delete photo')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Check if project is assigned to current user
    if (!widget.project.isAssigned) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('New Valuation'),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                const SizedBox(height: 16),
                Text(
                  'Project Not Assigned',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'This project has not been assigned to a field officer yet.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final screenWidth = MediaQuery.of(context).size.width;
    final isSmallScreen = screenWidth < 360;
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Form(
        key: _formKey,
        child: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) {
            return [
              SliverAppBar(
                expandedHeight: 140.0,
                floating: false,
                pinned: true,
                backgroundColor: const Color(0xFF0D47A1),
                elevation: 0,
                flexibleSpace: FlexibleSpaceBar(
                  titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
                  title: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        widget.existingValuation != null ? 'Edit Valuation' : 'New Valuation',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          shadows: [Shadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2))],
                        ),
                      ),
                      Text(
                        widget.project.title,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.8),
                          fontSize: 11,
                          fontWeight: FontWeight.normal,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Color(0xFF0D47A1), Color(0xFF1976D2)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          right: -20,
                          top: -20,
                          child: Icon(
                            widget.existingValuation != null ? Icons.edit_note_rounded : Icons.add_circle_outline_rounded,
                            color: Colors.white.withOpacity(0.1),
                            size: 150,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ];
          },
          body: ListView(
            padding: EdgeInsets.all(isSmallScreen ? 12 : 16),
            children: [
              // Project Info Card
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    color: Theme.of(context).cardColor,
                    child: Padding(
                      padding: EdgeInsets.all(isSmallScreen ? 12 : 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isDark ? const Color(0xFF1E293B) : Colors.blue[100],
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.folder_open, color: isDark ? Colors.blue[200] : Colors.blue[700], size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Project Information',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? Colors.white : Colors.black87,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      widget.project.title,
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: isDark ? Colors.grey[300] : Colors.grey[700],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (widget.project.description != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF0F172A) : Colors.grey[50],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                widget.project.description!,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: isDark ? Colors.grey[200] : Colors.grey[800],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  // Show edit status banner if editing submitted valuation
                  if (widget.existingValuation != null && widget.existingValuation!.status == 'submitted') ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: widget.existingValuation!.canBeEdited 
                            ? Colors.orange[50] 
                            : Colors.red[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: widget.existingValuation!.canBeEdited 
                              ? Colors.orange[300]! 
                              : Colors.red[300]!,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: widget.existingValuation!.canBeEdited 
                                  ? Colors.orange[100] 
                                  : Colors.red[100],
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              widget.existingValuation!.canBeEdited 
                                  ? Icons.info_outline 
                                  : Icons.error_outline,
                              color: widget.existingValuation!.canBeEdited 
                                  ? Colors.orange[900] 
                                  : Colors.red[900],
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              widget.existingValuation!.canBeEdited
                                  ? 'This valuation was submitted. You can edit it within 2 hours of creation. Editing will reset it to draft status.'
                                  : 'This valuation was submitted more than 2 hours ago and cannot be edited.',
                              style: TextStyle(
                                color: widget.existingValuation!.canBeEdited 
                                    ? Colors.orange[900] 
                                    : Colors.red[900],
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  // Category Selection Card
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    color: Theme.of(context).cardColor,
                    child: Padding(
                      padding: EdgeInsets.all(isSmallScreen ? 12 : 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.category, color: Colors.blue[700], size: 20),
                              const SizedBox(width: 8),
                              Text(
                                'Category *',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _buildModernCategoryChip('land', 'Land', Icons.landscape),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _buildModernCategoryChip('building', 'Building', Icons.business),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: _buildModernCategoryChip('vehicle', 'Vehicle', Icons.directions_car),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _buildModernCategoryChip('other', 'Other', Icons.category),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Common Information Card
                  _buildSectionCard(
                    title: 'Common Information',
                    icon: Icons.info_outline,
                    child: Column(
                      children: [
                        _buildModernTextField(
                          _descriptionController,
                          'Description',
                          icon: Icons.description,
                          maxLines: 3,
                        ),
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            icon: const Icon(Icons.lightbulb_outline),
                            label: Text(_showSuggestions ? 'Hide suggestions' : 'Find similar items'),
                            onPressed: () {
                              setState(() {
                                _showSuggestions = !_showSuggestions;
                                _lastSuggestionQuery = _descriptionController.text.trim();
                              });
                            },
                          ),
                        ),
                        if (_showSuggestions && _descriptionController.text.trim().length >= 2)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: ItemSuggestionsWidget(
                              initialQuery: _lastSuggestionQuery,
                              category: _category,
                              onConfirm: (item) {
                                setState(() {
                                  _descriptionController.text = (item['title'] ?? '').toString();
                                  _showSuggestions = false;
                                });
                              },
                              onEdit: (edited) {
                                setState(() {
                                  _descriptionController.text = (edited['title'] ?? '').toString();
                                  _showSuggestions = false;
                                });
                              },
                              onCreateNew: () {
                                setState(() => _showSuggestions = false);
                              },
                            ),
                          ),
                        const SizedBox(height: 16),
                        _buildModernTextField(
                          _estimatedValueController,
                          'Base Value (LKR)',
                          icon: Icons.account_balance_wallet,
                          keyboardType: TextInputType.number,
                        ),
                        const SizedBox(height: 16),
                        // Price Calculation Section
                        _buildPriceCalculationSection(),
                        // New Price Field (shown after calculation)
                        if (_showNewPriceField) ...[
                          const SizedBox(height: 16),
                          _buildModernTextField(
                            _newPriceController,
                            'New Price (LKR)',
                            icon: Icons.account_balance_wallet,
                            keyboardType: TextInputType.number,
                          ),
                        ],
                        const SizedBox(height: 16),
                        _buildModernTextField(
                          _notesController,
                          'Notes',
                          icon: Icons.note,
                          maxLines: 3,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Feature #12: Depreciation calculator (not applicable for land)
                  if (_category != 'land') ...[
                    DepreciationWidget(
                      category: _category,
                      onResult: (result) {
                        _depreciationResult = result;
                      },
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Category-specific fields
                  if (_category == 'land') _buildLandFields(),
                  if (_category == 'building') _buildBuildingFields(),
                  if (_category == 'vehicle') _buildVehicleFields(),
                  if (_category == 'other') _buildOtherFields(),
                  
                  // Google Maps Link (shown once for the active category)
                  if ((_category == 'land' && _landLatitude != null && _landLongitude != null) ||
                      (_category == 'building' && _buildingLatitude != null && _buildingLongitude != null)) ...[
                    const SizedBox(height: 12),
                    _buildGoogleMapsLink(),
                  ],
                  
                  const SizedBox(height: 16),
                  
                  // Photos Section Card
                  _buildSectionCard(
                    title: 'Photos',
                    icon: Icons.photo_library,
                    child: _buildPhotosSection(),
                  ),
                  
                  SizedBox(height: isSmallScreen ? 16 : 24),
                  
                  // Action Button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => _saveValuation(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        side: BorderSide(color: Colors.blue[400]!, width: 2),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text(
                              'Save Report',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                  if (_valuationId != null && (widget.existingValuation?.status == 'draft' || widget.existingValuation?.status == 'rejected')) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : () => _submitValuation(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green[700],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Submit to Accessor',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                  SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
                ],
              ),
            ),
          ),
        );
  }

  Widget _buildCategoryChip(String value, String label, IconData icon) {
    final isSelected = _category == value;
    return FilterChip(
      selected: isSelected,
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 4),
          Text(label),
        ],
      ),
      onSelected: (selected) {
        setState(() => _category = value);
      },
    );
  }

  Widget _buildModernCategoryChip(String value, String label, IconData icon) {
    final isSelected = _category == value;
    return InkWell(
      onTap: () {
        setState(() => _category = value);
        // Automatically detect location when category changes to land or building
        if (value == 'land' || value == 'building') {
          _getCurrentLocation();
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue[50] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? Colors.blue[600]! : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? Colors.blue[700] : Colors.grey[600],
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? Colors.blue[900] : Colors.grey[700],
                ),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(width: 4),
              Icon(Icons.check_circle, color: Colors.blue[700], size: 18),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required IconData icon, required Widget child}) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isSmallScreen = screenWidth < 360;
    
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: EdgeInsets.all(isSmallScreen ? 12 : 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: Colors.blue[700]!, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildModernTextField(
    TextEditingController controller,
    String label, {
    IconData? icon,
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      style: const TextStyle(fontSize: 16),
      decoration: InputDecoration(
        labelText: label,
        hintText: 'Enter $label',
        prefixIcon: icon != null ? Icon(icon, color: Colors.blue[700]) : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        filled: true,
        fillColor: Colors.grey[50],
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      maxLines: maxLines,
      keyboardType: keyboardType,
    );
  }

  Widget _buildPriceCalculationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.blue[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.blue[200]!, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.calculate, color: Colors.blue[700], size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Price Calculation',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Calculation Type Selection
              Row(
                children: [
                  Expanded(
                    child: _buildCalculationTypeButton('appreciation', 'Appreciation', Icons.trending_up, const Color(0xFF84BCDA)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildCalculationTypeButton('depreciation', 'Depreciation', Icons.trending_down, Colors.red),
                  ),
                ],
              ),
              if (_calculationType != null) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _calculationMethod,
                  decoration: const InputDecoration(
                    labelText: 'Method',
                    prefixIcon: Icon(Icons.functions),
                  ),
                  items: _availableMethods
                      .map(
                        (m) => DropdownMenuItem<String>(
                          value: m,
                          child: Text(_calculationMethodLabels[m] ?? m),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() {
                      _calculationMethod = v;
                    });
                  },
                ),
              ],
              // Calculation Input Fields (shown when type is selected)
              if (_calculationType != null) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildModernTextField(
                        _rateController,
                        'Rate (%)',
                        icon: Icons.percent,
                        keyboardType: TextInputType.numberWithOptions(decimal: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildModernTextField(
                        _yearsController,
                        'Number of Years',
                        icon: Icons.calendar_today,
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _calculateNewPrice,
                    icon: const Icon(Icons.calculate),
                    label: const Text('Calculate New Price'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCalculationTypeButton(String value, String label, IconData icon, Color color) {
    final isSelected = _calculationType == value;
    return InkWell(
      onTap: () {
        setState(() {
          _calculationType = value;
          _calculationMethod =
              value == 'appreciation' ? 'compound_annual' : 'reducing_balance';
          // Clear previous calculation inputs
          _rateController.clear();
          _yearsController.clear();
        });
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.2) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? color : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? color : Colors.grey[600],
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? color : Colors.grey[700],
                ),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _calculateNewPrice() {
    // Get current base value
    final currentValue = double.tryParse(_estimatedValueController.text);
    if (currentValue == null || currentValue <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid base value first'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Get rate
    final rate = double.tryParse(_rateController.text);
    if (rate == null || rate <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid rate'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Get years
    final years = int.tryParse(_yearsController.text);
    if (years == null || years <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid number of years'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final method = _calculationMethod ??
        (_calculationType == 'appreciation'
            ? 'compound_annual'
            : 'reducing_balance');

    // Calculate using selected valuation adjustment method.
    double newPrice;
    if (_calculationType == 'appreciation') {
      switch (method) {
        case 'simple_interest':
          newPrice = currentValue * (1 + (rate / 100) * years);
          break;
        case 'compound_monthly':
          newPrice = currentValue * math.pow(1 + (rate / 1200), years * 12).toDouble();
          break;
        case 'compound_annual':
        default:
          newPrice = currentValue * math.pow(1 + (rate / 100), years).toDouble();
          break;
      }
    } else {
      switch (method) {
        case 'straight_line':
          newPrice = currentValue * (1 - (rate / 100) * years);
          break;
        case 'double_declining':
          final factor = (2 * (rate / 100)).clamp(0.0, 1.0);
          newPrice = currentValue;
          for (int i = 0; i < years; i++) {
            newPrice = newPrice * (1 - factor);
          }
          break;
        case 'reducing_balance':
        default:
          newPrice = currentValue * math.pow(1 - (rate / 100), years).toDouble();
          break;
      }
    }

    if (newPrice < 0) newPrice = 0;

    // Round to 2 decimal places
    newPrice = double.parse(newPrice.toStringAsFixed(2));

    // Update the new price field and show it (don't modify base value)
    setState(() {
      _newPriceController.text = newPrice.toString();
      _showNewPriceField = true;
    });

    // Show success message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'New price calculated: LKR ${newPrice.toStringAsFixed(2)}',
        ),
        backgroundColor: const Color(0xFF84BCDA),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildLandFields() {

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionCard(
          title: 'Land Details',
          icon: Icons.landscape,
          child: Column(
            children: [
              _buildModernTextField(
                _landAreaController,
                'Area (sq meters)',
                icon: Icons.square_foot,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              _buildModernTextField(
                _landTypeController,
                'Land Type (e.g., Residential, Commercial)',
                icon: Icons.category,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _landLocationController,
                style: const TextStyle(fontSize: 16),
                decoration: InputDecoration(
                  labelText: 'Location Coordinates',
                  prefixIcon: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : Icon(Icons.location_on, color: Colors.blue[700]),
                  hintText: _isLoading ? 'Detecting location...' : 'Location will be detected automatically',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey[50],
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
                readOnly: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildBuildingFields() {

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionCard(
          title: 'Building Details',
          icon: Icons.business,
          child: Column(
            children: [
              _buildModernTextField(
                _buildingAreaController,
                'Area (sq meters)',
                icon: Icons.square_foot,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              _buildModernTextField(
                _buildingTypeController,
                'Building Type (e.g., House, Apartment)',
                icon: Icons.home,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _buildingLocationController,
                style: const TextStyle(fontSize: 16),
                decoration: InputDecoration(
                  labelText: 'Location Coordinates',
                  prefixIcon: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : Icon(Icons.location_on, color: Colors.blue[700]),
                  hintText: _isLoading ? 'Detecting location...' : 'Location will be detected automatically',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey[50],
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
                readOnly: true,
              ),
              // Google Maps link for building location
              if (_buildingLatitude != null && _buildingLongitude != null) ...[
                const SizedBox(height: 12),
                _buildGoogleMapsLink(),
              ],
              const SizedBox(height: 16),
              _buildModernTextField(
                _numberOfFloorsController,
                'Number of Floors',
                icon: Icons.layers,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              _buildModernTextField(
                _yearBuiltController,
                'Year Built',
                icon: Icons.calendar_today,
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildVehicleFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionCard(
          title: 'Vehicle Details',
          icon: Icons.directions_car,
          child: Column(
            children: [
              _buildModernTextField(_vehicleMakeController, 'Make', icon: Icons.build),
              const SizedBox(height: 16),
              _buildModernTextField(_vehicleModelController, 'Model', icon: Icons.directions_car),
              const SizedBox(height: 16),
              _buildModernTextField(_vehicleYearController, 'Year', icon: Icons.calendar_today, keyboardType: TextInputType.number),
              const SizedBox(height: 16),
              _buildModernTextField(_vehicleRegistrationController, 'Registration Number', icon: Icons.confirmation_number),
              const SizedBox(height: 16),
              _buildModernTextField(_vehicleMileageController, 'Mileage', icon: Icons.speed, keyboardType: TextInputType.number),
              const SizedBox(height: 16),
              _buildModernTextField(_vehicleConditionController, 'Condition (e.g., Excellent, Good, Fair)', icon: Icons.star),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildOtherFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionCard(
          title: 'Other Details',
          icon: Icons.category,
          child: Column(
            children: [
              _buildModernTextField(_otherTypeController, 'Type', icon: Icons.category),
              const SizedBox(height: 16),
              _buildModernTextField(_otherSpecificationsController, 'Specifications', icon: Icons.description, maxLines: 3),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildGoogleMapsLink() {
    double? lat;
    double? lng;
    
    if (_category == 'land' && _landLatitude != null && _landLongitude != null) {
      lat = _landLatitude;
      lng = _landLongitude;
    } else if (_category == 'building' && _buildingLatitude != null && _buildingLongitude != null) {
      lat = _buildingLatitude;
      lng = _buildingLongitude;
    }

    if (lat == null || lng == null) return const SizedBox.shrink();

    return InkWell(
      onTap: () async {
        try {
          // Use the most reliable web URL format
          final webUrl = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
          
          // Try to launch - don't check canLaunchUrl first as it may return false incorrectly
          try {
            await launchUrl(
              webUrl,
              mode: LaunchMode.externalApplication,
            );
          } catch (e) {
            // If external application fails, try platform default (opens in browser)
            try {
              await launchUrl(
                webUrl,
                mode: LaunchMode.platformDefault,
              );
            } catch (e2) {
              // Last resort: try in-app web view
              try {
                await launchUrl(
                  webUrl,
                  mode: LaunchMode.inAppWebView,
                );
              } catch (e3) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Could not open maps. Please try opening manually: ${webUrl.toString()}'),
                      duration: const Duration(seconds: 5),
                    ),
                  );
                }
              }
            }
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Error opening maps: $e'),
                duration: const Duration(seconds: 3),
              ),
            );
          }
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.blue[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.blue[200]!, width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.blue[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.map, color: Colors.blue[700], size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'View on Google Maps',
                    style: TextStyle(
                      color: Colors.blue[900],
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tap to open location in maps',
                    style: TextStyle(
                      color: Colors.blue[700],
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, color: Colors.blue[700], size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _pickImage,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.blue[300]!,
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.blue.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.blue[50],
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.photo_library_rounded,
                              color: Colors.blue[700],
                              size: 32,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _takePhoto,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.blue[300]!,
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.blue.withOpacity(0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.blue[50],
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.camera_alt_rounded,
                              color: Colors.blue[700],
                              size: 32,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_existingPhotos.isNotEmpty || _selectedPhotos.isNotEmpty) ...[
          if (_selectedPhotos.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text(
              'Long-press and drag to reorder. Tap the star to mark as the primary photo.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              buildDefaultDragHandles: true,
              itemCount: _selectedPhotos.length,
              onReorder: (oldIndex, newIndex) {
                setState(() {
                  if (newIndex > oldIndex) newIndex -= 1;
                  final photo = _selectedPhotos.removeAt(oldIndex);
                  _selectedPhotos.insert(newIndex, photo);
                  if (_photoMeta.length > oldIndex) {
                    final m = _photoMeta.removeAt(oldIndex);
                    _photoMeta.insert(newIndex.clamp(0, _photoMeta.length), m);
                  }
                  if (_primaryPhotoIndex == oldIndex) {
                    _primaryPhotoIndex = newIndex;
                  } else if (_primaryPhotoIndex > oldIndex && _primaryPhotoIndex <= newIndex) {
                    _primaryPhotoIndex -= 1;
                  } else if (_primaryPhotoIndex < oldIndex && _primaryPhotoIndex >= newIndex) {
                    _primaryPhotoIndex += 1;
                  }
                });
              },
              itemBuilder: (ctx, i) {
                final photo = _selectedPhotos[i];
                return Padding(
                  key: ValueKey(photo.path),
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      IconButton(
                        icon: Icon(
                          i == _primaryPhotoIndex ? Icons.star : Icons.star_border,
                          color: i == _primaryPhotoIndex ? Colors.amber[700] : Colors.grey,
                        ),
                        tooltip: 'Mark as primary',
                        onPressed: () => setState(() => _primaryPhotoIndex = i),
                      ),
                      SizedBox(
                        width: 70,
                        height: 70,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(photo, fit: BoxFit.cover),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          photo.path.split('/').last,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.red),
                        onPressed: () => setState(() {
                          _selectedPhotos.removeAt(i);
                          if (i < _photoMeta.length) _photoMeta.removeAt(i);
                          if (_primaryPhotoIndex >= _selectedPhotos.length) {
                            _primaryPhotoIndex = _selectedPhotos.isEmpty ? 0 : _selectedPhotos.length - 1;
                          }
                        }),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
          if (_existingPhotos.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _existingPhotos.map((photo) => _buildPhotoThumbnail(
                photoUrl: photo.photoUrl,
                onDelete: () => _deletePhoto(photo),
              )).toList(),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildPhotoThumbnail({String? photoUrl, File? photoFile, required VoidCallback onDelete}) {
    return Stack(
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: photoFile != null
                ? Image.file(photoFile, fit: BoxFit.cover)
                : photoUrl != null
                    ? Image.network(photoUrl, fit: BoxFit.cover)
                    : const Icon(Icons.image),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: CircleAvatar(
            radius: 12,
            backgroundColor: Colors.red,
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: const Icon(Icons.close, size: 16, color: Colors.white),
              onPressed: onDelete,
            ),
          ),
        ),
      ],
    );
  }
}

