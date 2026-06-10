import 'dart:io';
import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart' show rootBundle;
import '../models/valuation_model.dart';
import '../models/project_model.dart';

/// Generates a professionally formatted A4 PDF report for a valuation.
///
/// The report follows a standard eight-section layout used by the company:
///   I.   General Information    — client, project, dates, field officer name.
///   II.  Asset Identification   — category, location, Google Maps link.
///   III. Valuation Methodology  — explanation of the method used (auto-generated text).
///   IV.  Asset Details          — tables with land/building/vehicle/other specifics.
///   V.   Assumptions            — professional context and any adjustments applied.
///   VI.  Supporting Documentation — evidence photos embedded as thumbnails.
///   VII. Conclusion & Certification — final value statement and sign-off block.
///   VIII. Distribution          — list of who receives the report.
///
/// Photos are downloaded from their server URLs before building the PDF so they
/// are embedded directly in the document.
/// The company logo is loaded from the app's asset bundle.
/// The finished file is saved to the device's documents directory and the
/// [File] path is returned so the caller can upload or share it.
class PdfService {
  /// Generates the full valuation report PDF and saves it to the device.
  ///
  /// Step-by-step process:
  ///   1. Downloads all evidence photos from the server so they can be embedded.
  ///   2. Loads the company logo from the app's asset bundle (falls back to text).
  ///   3. Creates an A4 document with a 10 mm black border on every page and
  ///      auto-numbered page footers.
  ///   4. Adds a single multi-page section containing all eight report sections.
  ///   5. Saves the PDF bytes to a uniquely-named file in the documents directory.
  ///   6. Returns the [File] so the caller can upload it to the server.
  ///
  /// Throws on unrecoverable errors so the caller can show the user an error message.
  static Future<File> generateValuationReport({
    required Valuation valuation,
    required Project project,
  }) async {
    try {
      print('PDF Service: Starting PDF generation');
      print('Valuation ID: ${valuation.id}');
      print('Category: ${valuation.category}, CategoryDisplay: ${valuation.categoryDisplay}');
      print('Status: ${valuation.status}, StatusDisplay: ${valuation.statusDisplay}');
      
      final pdf = pw.Document();
      final dateFormat = DateFormat('MMMM dd, yyyy');

      // Store nullable values before building PDF
      final notes = valuation.notes;
      
      // Download all photos before building PDF
      print('PDF Service: Downloading ${valuation.photos.length} photos');
      List<pw.Widget> photoWidgets = [];
      for (var photo in valuation.photos) {
        if (photo.photoUrl != null && photo.photoUrl!.isNotEmpty) {
          try {
            print('PDF Service: Downloading photo from ${photo.photoUrl}');
            final response = await http.get(Uri.parse(photo.photoUrl!));
            if (response.statusCode == 200) {
              final photoContainer = pw.Container(
                width: 100,
                height: 100,
                decoration: pw.BoxDecoration(
                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                  border: pw.Border.all(
                    color: PdfColors.black,
                    width: 1,
                  ),
                ),
                child: pw.Image(
                  pw.MemoryImage(response.bodyBytes),
                  fit: pw.BoxFit.cover,
                  width: 100,
                  height: 100,
                ),
              );
              photoWidgets.add(photoContainer);
              print('PDF Service: Successfully loaded photo ${photo.id}');
            } else {
              print('PDF Service: Failed to load photo ${photo.id}, status code: ${response.statusCode}');
            }
          } catch (e) {
            print('PDF Service: Error loading photo ${photo.id}: $e');
          }
        }
      }
      print('PDF Service: Successfully loaded ${photoWidgets.length} out of ${valuation.photos.length} photos');
      
      // Load company logo from assets
      pw.Widget? logoWidget;
      try {
        final ByteData logoData = await rootBundle.load('assets/Company Logo White.png');
        final Uint8List logoBytes = logoData.buffer.asUint8List();
        logoWidget = pw.Image(
          pw.MemoryImage(logoBytes),
          width: 200,
          height: 200,
          fit: pw.BoxFit.contain,
        );
        print('PDF Service: Successfully loaded company logo');
      } catch (e) {
        print('PDF Service: Error loading logo: $e');
        // Fallback to text logo if image fails to load
        logoWidget = pw.Container(
          width: 100,
          height: 100,
          decoration: pw.BoxDecoration(
            color: PdfColors.black,
            shape: pw.BoxShape.circle,
          ),
          alignment: pw.Alignment.center,
          child: pw.Text(
            'AUDITRA',
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(
              color: PdfColors.white,
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        );
      }
      
      pdf.addPage(
      pw.MultiPage(
        pageTheme: pw.PageTheme(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(28.35), // 10mm = 28.35 points (for document border)
          buildBackground: (pw.Context context) {
            // Draw document border on every page - 2px solid black, 10mm from page edges
            return pw.Stack(
              children: [
                pw.Container(
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(
                      color: PdfColors.black,
                      width: 2,
                    ),
                  ),
                ),
                // Page number at the bottom center
                pw.Positioned(
                  bottom: 15,
                  left: 0,
                  right: 0,
                  child: pw.Container(
                    alignment: pw.Alignment.center,
                    child: pw.Text(
                      'Page ${context.pageNumber} of ${context.pagesCount}',
                      style: pw.TextStyle(
                        fontSize: 9,
                        color: PdfColors.black,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
        build: (pw.Context context) {
          // Content with padding to account for border
          return [
            pw.Padding(
              padding: const pw.EdgeInsets.all(56.7), // 20mm = 56.7 points (content padding)
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // Header with logo and company info
                  _buildHeader(logoWidget!),
                  pw.SizedBox(height: 20),
                  
                  // Main Title
                  pw.Center(
                    child: pw.Text(
                      'Asset Valuation Evaluation Form',
                      style: pw.TextStyle(
                        fontSize: 24,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 20),
                  
                  // Introduction
                  pw.Paragraph(
                    text: 'This report presents a detailed valuation assessment of the asset, prepared in accordance with established valuation standards and professional practices. The valuation methodology, assumptions, and supporting documentation are presented in the following sections to provide a comprehensive understanding of the asset\'s fair market value.',
                    textAlign: pw.TextAlign.justify,
                    style: pw.TextStyle(
                      fontSize: 10,
                      lineSpacing: 1.6,
                    ),
                  ),
                  pw.SizedBox(height: 25),
                  
                  // Section I: General Information
                  _buildSectionI(project, valuation, dateFormat),
                  pw.SizedBox(height: 25),
                  
                  // Section II: Asset Identification
                  _buildSectionII(valuation),
                  pw.SizedBox(height: 25),
                  
                  // Section III: Valuation Methodology
                  _buildSectionIII(valuation, notes),
                  pw.SizedBox(height: 40),
                  
                  // Section IV: Asset Details
                  _buildSectionIV(valuation),
                  pw.SizedBox(height: 25),
                  
                  // Section V: Valuation Assumptions
                  _buildSectionV(valuation, notes),
                  pw.SizedBox(height: 40),
                  
                  // Section VI: Supporting Documentation
                  _buildSectionVI(valuation, notes, photoWidgets),
                  pw.SizedBox(height: 25),
                  
                  // Section VII: Conclusion and Certification
                  _buildSectionVII(notes, valuation),
                  pw.SizedBox(height: 25),
                  
                  // Section VIII: Distribution
                  _buildSectionVIII(project),
                  pw.SizedBox(height: 40),
                  
                  // Footer
                  _buildFooter(),
                ],
              ),
            ),
          ];
        },
      ),
      );

      // Save to file
      print('PDF Service: Saving PDF to file');
      final output = await getApplicationDocumentsDirectory();
      final file = File('${output.path}/valuation_report_${valuation.id}_${DateTime.now().millisecondsSinceEpoch}.pdf');
      await file.writeAsBytes(await pdf.save());
      
      print('PDF Service: PDF generated successfully');
      return file;
    } catch (e, stackTrace) {
      print('PDF Service Error: $e');
      print('Stack trace: $stackTrace');
      rethrow;
    }
  }

  /// Builds the page header: company logo on the left, company contact info on the right.
  static pw.Widget _buildHeader(pw.Widget logoWidget) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        // Company Logo (left side)
        logoWidget,
        
        // Company Info (right side)
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.end,
          children: [
            pw.Text(
              'Company Email Address',
              style: pw.TextStyle(fontSize: 11),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              'Company Website',
              style: pw.TextStyle(fontSize: 11),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              'Company Number',
              style: pw.TextStyle(fontSize: 11),
            ),
            pw.SizedBox(height: 4),
            pw.Text(
              'Company Social Media',
              style: pw.TextStyle(fontSize: 11),
            ),
          ],
        ),
      ],
    );
  }

  /// Builds Section I: General Information table.
  /// Shows the client name/email, field officer who prepared the report,
  /// the project title, and the valuation date.
  static pw.Widget _buildSectionI(Project project, Valuation valuation, DateFormat dateFormat) {
    final valuationDate = valuation.submittedAt ?? valuation.createdAt;
    final preparedBy = valuation.fieldOfficerName ?? valuation.fieldOfficerUsername;
    
    // Get client name - try assignedClientName first, then clientInfo, then fallback
    String clientName = 'Not specified';
    if (project.assignedClientName != null && project.assignedClientName!.isNotEmpty) {
      clientName = project.assignedClientName!;
    } else if (project.clientInfo != null && project.clientInfo!['name'] != null) {
      clientName = project.clientInfo!['name'].toString();
    } else if (project.assignedClientUsername != null) {
      clientName = project.assignedClientUsername!;
    }
    
    // Get client email - try assignedClientEmail first, then clientInfo
    String clientEmail = 'Not specified';
    if (project.assignedClientEmail != null && project.assignedClientEmail!.isNotEmpty) {
      clientEmail = project.assignedClientEmail!;
    } else if (project.clientInfo != null && project.clientInfo!['email'] != null) {
      clientEmail = project.clientInfo!['email'].toString();
    }
    
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'I. General Information',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.black, width: 1),
          columnWidths: {
            0: pw.FlexColumnWidth(0.4),
            1: pw.FlexColumnWidth(0.6),
          },
          children: [
            _buildInfoTableRow('Name of client:', clientName),
            _buildInfoTableRow('Date of valuation:', dateFormat.format(valuationDate)),
            _buildInfoTableRow('Valuation prepared by:', preparedBy),
            _buildInfoTableRow('Client contact information:', clientEmail),
          ],
        ),
      ],
    );
  }

  /// Builds Section II: Asset Identification table.
  /// Shows the asset category, location (GPS for land/building, registration for
  /// vehicles, type label for other), and a clickable Google Maps URL if available.
  static pw.Widget _buildSectionII(Valuation valuation) {
    // Determine location based on category
    final category = valuation.category.toLowerCase();
    String location = 'Not specified';
    String? googleMapsUrl;
    
    if (category == 'land') {
      location = valuation.landLocation ?? 'Not specified';
      if (valuation.landLatitude != null && valuation.landLongitude != null) {
        googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=${valuation.landLatitude},${valuation.landLongitude}';
      }
    } else if (category == 'building') {
      location = valuation.buildingLocation ?? 'Not specified';
      if (valuation.buildingLatitude != null && valuation.buildingLongitude != null) {
        googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=${valuation.buildingLatitude},${valuation.buildingLongitude}';
      }
    } else if (category == 'vehicle' && valuation.vehicleRegistrationNumber != null) {
      location = valuation.vehicleRegistrationNumber!;
    } else if (category == 'other' && valuation.otherType != null) {
      location = valuation.otherType!;
    }

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'II. Asset Identification',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.black, width: 1),
          columnWidths: {
            0: pw.FixedColumnWidth(100),  // Asset Type
            1: pw.FlexColumnWidth(1.5),   // Description
            2: pw.FixedColumnWidth(100),  // Identification Number
            3: pw.FlexColumnWidth(1.5),   // Location
          },
          children: [
            // Header row
            pw.TableRow(
              decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E0E0E0')),
              children: [
                _buildTableCell('Asset Type', isHeader: true),
                _buildTableCell('Description', isHeader: true),
                _buildTableCell('Identification\nNumber', isHeader: true),
                _buildTableCell('Location', isHeader: true),
              ],
            ),
            // Data row
            pw.TableRow(
              children: [
                _buildTableCell(valuation.categoryDisplay),
                _buildTableCell(valuation.description ?? valuation.categoryDisplay),
                _buildTableCell(valuation.id.toString()),
                _buildTableCell(location),
              ],
            ),
          ],
        ),
        // Google Maps Link (if available) - placed under the table
        if (googleMapsUrl != null) ...[
          pw.SizedBox(height: 10),
          pw.UrlLink(
            destination: googleMapsUrl,
            child: pw.Text(
              '[Google Map Link]',
              style: pw.TextStyle(
                fontSize: 9,
                color: PdfColor.fromHex('#1976D2'),
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// Strips the `[VALUATION_CALCULATION]...[/VALUATION_CALCULATION]` block from
  /// the notes field before displaying it in the PDF. That block is only needed
  /// by the app internally and would look confusing to the reader in a printed report.
  static String _cleanNotesForDisplay(String? notes) {
    if (notes == null || notes.isEmpty) return '';
    
    // Remove the calculation block if present
    String cleanedNotes = notes.replaceAll(
      RegExp(r'\[VALUATION_CALCULATION\].*?\[/VALUATION_CALCULATION\]', dotAll: true, caseSensitive: false),
      '',
    ).trim();
    
    return cleanedNotes;
  }

  /// Builds Section III: Valuation Methodology.
  /// Displays auto-generated text that explains the valuation approach used,
  /// based on the asset's category and any appreciation/depreciation method chosen.
  static pw.Widget _buildSectionIII(Valuation valuation, String? notes) {
    // Generate methodology text based on category and calculation method
    final methodologyText = _generateMethodologyText(valuation, notes);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'III. Valuation Methodology',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: methodologyText,
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
      ],
    );
  }

  /// Generates the methodology paragraph text based on asset category and
  /// any appreciation/depreciation adjustment stored in the valuation notes.
  /// Reads the `[VALUATION_CALCULATION]` block from notes to determine if
  /// an adjustment was applied and at what rate.
  static String _generateMethodologyText(Valuation valuation, String? notes) {
    // Parse calculation data from notes to determine if appreciation/depreciation was applied
    final calculationData = _parseCalculationDataFromNotes(notes);
    final adjustmentType = calculationData['adjustmentType'];
    final rate = calculationData['rate'];
    final years = calculationData['years'];
    final hasAdjustment = adjustmentType != null && 
                          adjustmentType.toLowerCase() != 'none' && 
                          rate != null && 
                          years != null;

    final category = valuation.category.toLowerCase();
    String methodology = '';

    switch (category) {
      case 'land':
        methodology = 'The valuation of this land asset was conducted using the Market Approach, specifically employing the Comparable Sales Method. This methodology involves analyzing recent sales of similar land parcels in the same or comparable locations, considering factors such as location, size, land type, accessibility, zoning regulations, and current market conditions.';
        
        if (valuation.landLocation != null && valuation.landLocation!.isNotEmpty) {
          methodology += ' The location of the asset ($valuation.landLocation) was a primary consideration in identifying comparable properties.';
        }
        
        if (valuation.landArea != null) {
          methodology += ' The total land area of $valuation.landArea square units was evaluated in relation to comparable sales on a per-unit basis.';
        }
        
        methodology += ' Adjustments were made to the comparable sales prices to account for differences in size, location advantages, development potential, and market timing. The final valuation reflects the most probable price that the asset would realize in an open and competitive market.';
        break;

      case 'building':
        methodology = 'The valuation of this building asset was conducted using a combination of the Cost Approach and Market Approach methodologies.';
        
        if (valuation.buildingType != null && valuation.buildingType!.isNotEmpty) {
          methodology += ' As a $valuation.buildingType property,';
        } else {
          methodology += ' The building';
        }
        
        methodology += ' the valuation considers the replacement cost of the structure, accounting for current construction costs, materials, labor, and applicable overheads.';
        
        if (valuation.buildingArea != null) {
          methodology += ' The total building area of $valuation.buildingArea square units was evaluated to determine the replacement cost on a per-square-unit basis.';
        }
        
        if (valuation.yearBuilt != null) {
          final currentYear = DateTime.now().year;
          final age = currentYear - valuation.yearBuilt!;
          methodology += ' The building\'s age ($age years, built in ${valuation.yearBuilt}) was considered in assessing depreciation and physical deterioration.';
        }
        
        if (valuation.numberOfFloors != null) {
          methodology += ' The number of floors (${valuation.numberOfFloors}) was factored into the valuation, as multi-story buildings may have different per-unit costs and market values.';
        }
        
        methodology += ' Additionally, comparable sales of similar buildings in the area were analyzed to validate the cost-based estimate and ensure alignment with current market conditions. The final valuation represents the fair market value considering both the replacement cost and prevailing market rates.';
        break;

      case 'vehicle':
        methodology = 'The valuation of this vehicle asset was conducted using the Market Approach, specifically the Comparable Sales Method for vehicles, combined with depreciation analysis.';
        
        if (valuation.vehicleMake != null && valuation.vehicleMake!.isNotEmpty && 
            valuation.vehicleModel != null && valuation.vehicleModel!.isNotEmpty) {
          methodology += ' For the $valuation.vehicleMake $valuation.vehicleModel,';
        } else {
          methodology += ' The vehicle';
        }
        
        methodology += ' the valuation process involved:';
        
        if (valuation.vehicleYear != null) {
          final currentYear = DateTime.now().year;
          final age = currentYear - valuation.vehicleYear!;
          methodology += ' (1) Age consideration: The vehicle is $age years old (model year ${valuation.vehicleYear}), which directly impacts its market value through depreciation.';
        }
        
        if (valuation.vehicleMileage != null) {
          methodology += ' (2) Mileage assessment: The recorded mileage of $valuation.vehicleMileage kilometers/miles was evaluated against typical usage patterns for vehicles of similar age and type.';
        }
        
        if (valuation.vehicleCondition != null && valuation.vehicleCondition!.isNotEmpty) {
          methodology += ' (3) Condition evaluation: The vehicle\'s condition ($valuation.vehicleCondition) was assessed and compared against standard condition categories (excellent, good, fair, poor).';
        }
        
        methodology += ' (4) Market comparison: Recent sales and listings of comparable vehicles with similar make, model, year, mileage, and condition were analyzed to determine the prevailing market value.';
        
        if (valuation.vehicleRegistrationNumber != null && valuation.vehicleRegistrationNumber!.isNotEmpty) {
          methodology += ' The vehicle registration ($valuation.vehicleRegistrationNumber) was verified to ensure legal compliance.';
        }
        
        methodology += ' The final valuation reflects the fair market value based on the vehicle\'s specific characteristics and current market conditions.';
        break;

      case 'other':
        final assetType = valuation.otherType != null && valuation.otherType!.isNotEmpty 
            ? valuation.otherType 
            : 'asset';
        methodology = 'The valuation of this ${assetType} asset was conducted using a comprehensive valuation approach tailored to the specific nature of the asset.';
        
        if (valuation.otherSpecifications != null && valuation.otherSpecifications!.isNotEmpty) {
          methodology += ' The asset specifications ($valuation.otherSpecifications) were carefully analyzed to determine the most appropriate valuation methodology.';
        }
        
        methodology += ' The valuation process involved: (1) Asset identification and classification to determine the appropriate valuation approach; (2) Market research to identify comparable assets and prevailing market rates; (3) Condition assessment to evaluate the asset\'s physical state and functional utility; and (4) Market value determination based on the asset\'s characteristics, condition, and comparable market transactions.';
        
        methodology += ' The final valuation reflects the fair market value, representing the price that would be agreed upon between a willing buyer and a willing seller in an arm\'s-length transaction, with both parties having reasonable knowledge of the asset and market conditions.';
        break;

      default:
        methodology = 'The valuation process was carried out using established valuation methodologies appropriate for this asset type. The methodology considers the asset\'s specific characteristics, market conditions, and applicable valuation standards to ensure an accurate and reliable valuation.';
    }

    // Add information about appreciation/depreciation adjustments if applicable
    if (hasAdjustment) {
      final adjustmentTypeText = adjustmentType!.toLowerCase() == 'appreciation' 
          ? 'appreciation' 
          : 'depreciation';
      final rateText = rate != null ? '$rate%' : '';
      final yearsText = years != null ? years.toString() : '';
      final yearsPlural = years != null && years != 1 ? 's' : '';
      
      methodology += '\n\nAdditionally, an $adjustmentTypeText adjustment was applied to the base valuation using the compound interest methodology. This adjustment accounts for the change in value over $yearsText year$yearsPlural at an annual rate of $rateText. The compound interest method considers the time value of money and the cumulative effect of value changes over the specified period, providing a more accurate representation of the asset\'s current market value.';
    }

    return methodology;
  }

  /// Reads the `[VALUATION_CALCULATION]...[/VALUATION_CALCULATION]` block
  /// embedded inside the valuation notes field and returns a map with:
  ///   `baseValue`, `adjustmentType` (appreciation/depreciation),
  ///   `method`, `rate`, `years`, `newValue`.
  /// Returns an empty map if no block is found.
  static Map<String, dynamic> _parseCalculationDataFromNotes(String? notes) {
    final result = <String, dynamic>{};
    
    if (notes == null || notes.isEmpty) {
      return result;
    }

    // Look for structured calculation block [VALUATION_CALCULATION]...[/VALUATION_CALCULATION]
    final calculationBlockRegex = RegExp(
      r'\[VALUATION_CALCULATION\](.*?)\[/VALUATION_CALCULATION\]',
      dotAll: true,
      caseSensitive: false,
    );
    final calculationMatch = calculationBlockRegex.firstMatch(notes);

    if (calculationMatch != null) {
      // Found structured calculation data
      final calculationData = calculationMatch.group(1) ?? '';

      // Extract Base Value
      final baseValueRegex = RegExp(r'Base Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
      final baseMatch = baseValueRegex.firstMatch(calculationData);
      if (baseMatch != null) {
        final valueStr = baseMatch.group(1)?.replaceAll(',', '') ?? '';
        final baseValue = double.tryParse(valueStr);
        if (baseValue != null) {
          result['baseValue'] = baseValue;
        }
      }

      // Extract Adjustment Type
      final typeRegex = RegExp(r'Adjustment Type:\s*(Appreciation|Depreciation|None)', caseSensitive: false);
      final typeMatch = typeRegex.firstMatch(calculationData);
      if (typeMatch != null) {
        result['adjustmentType'] = typeMatch.group(1);
      }

      // Extract Rate
      final rateRegex = RegExp(r'Rate:\s*([\d,]+\.?\d*)\s*%', caseSensitive: false);
      final rateMatch = rateRegex.firstMatch(calculationData);
      if (rateMatch != null) {
        final rateStr = rateMatch.group(1)?.replaceAll(',', '') ?? '';
        final rate = double.tryParse(rateStr);
        if (rate != null) {
          result['rate'] = rate;
        }
      }

      // Extract Years
      final yearsRegex = RegExp(r'Years:\s*(\d+)', caseSensitive: false);
      final yearsMatch = yearsRegex.firstMatch(calculationData);
      if (yearsMatch != null) {
        final yearsStr = yearsMatch.group(1);
        final years = int.tryParse(yearsStr ?? '');
        if (years != null) {
          result['years'] = years;
        }
      }

      // Extract Calculated Value
      final calculatedValueRegex = RegExp(r'Calculated Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
      final calculatedMatch = calculatedValueRegex.firstMatch(calculationData);
      if (calculatedMatch != null) {
        final valueStr = calculatedMatch.group(1)?.replaceAll(',', '') ?? '';
        final calculatedValue = double.tryParse(valueStr);
        if (calculatedValue != null) {
          result['calculatedValue'] = calculatedValue;
        }
      }
    }

    return result;
  }

  /// Builds Section IV: Asset Details tables.
  /// For land and building: shows a tangible-assets table plus a valuation
  /// adjustments table (if appreciation/depreciation was applied).
  /// For vehicle and other: shows an intangible-assets table.
  static pw.Widget _buildSectionIV(Valuation valuation) {
    final currencyFormatter = NumberFormat.currency(symbol: 'LKR ', decimalDigits: 2);
    final isLandOrBuilding = valuation.category.toLowerCase() == 'land' || valuation.category.toLowerCase() == 'building';
    final isVehicleOrOther = valuation.category.toLowerCase() == 'vehicle' || valuation.category.toLowerCase() == 'other';
    
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'IV. Asset Details',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        
        // Check category and build appropriate tables
        if (isLandOrBuilding) ...[
          // A. Tangible Assets
          pw.Text(
            'A. Tangible Assets:',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          _buildTangibleAssetsTable(valuation, currencyFormatter),
          pw.SizedBox(height: 15),
          // Valuation Adjustments subsection
          pw.Text(
            'Valuation Adjustments:',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          _buildValuationAdjustmentsTable(valuation, currencyFormatter),
        ],
        
        if (isVehicleOrOther) ...[
          // B. Intangible Assets (or other assets)
          pw.Text(
            'B. Intangible Assets:',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          _buildIntangibleAssetsTable(valuation, currencyFormatter),
          pw.SizedBox(height: 15),
          // Valuation Adjustments subsection
          pw.Text(
            'Valuation Adjustments:',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          _buildValuationAdjustmentsTable(valuation, currencyFormatter),
        ],
      ],
    );
  }

  /// Builds the tangible assets table used for land and building categories.
  /// Shows asset name, location, area, condition, base value, and current value.
  static pw.Widget _buildTangibleAssetsTable(Valuation valuation, NumberFormat currencyFormatter) {
    final estimatedValue = valuation.estimatedValue ?? 0.0;
    final category = valuation.category.toLowerCase();
    String assetName = 'Property';
    String location = 'Not specified';
    String area = 'Not specified';
    String additionalDetails = 'N/A';

    if (category == 'land') {
      assetName = 'Land Property';
      location = valuation.landLocation ?? 'Not specified';
      area = valuation.landArea != null ? '${valuation.landArea} sq meters' : 'Not specified';
      additionalDetails = valuation.landType ?? 'N/A';
    } else if (category == 'building') {
      assetName = 'Building Property';
      location = valuation.buildingLocation ?? 'Not specified';
      area = valuation.buildingArea != null ? '${valuation.buildingArea} sq meters' : 'Not specified';
      final floors = valuation.numberOfFloors?.toString() ?? 'N/A';
      final yearBuilt = valuation.yearBuilt?.toString() ?? 'N/A';
      additionalDetails = 'Floors: $floors, Year Built: $yearBuilt';
    }

    // Extract base value from notes if available
    double? baseValue;
    if (valuation.notes != null && valuation.notes!.isNotEmpty) {
      final notes = valuation.notes!;
      final calculationBlockRegex = RegExp(
        r'\[VALUATION_CALCULATION\](.*?)\[/VALUATION_CALCULATION\]',
        dotAll: true,
        caseSensitive: false,
      );
      final calculationMatch = calculationBlockRegex.firstMatch(notes);
      
      if (calculationMatch != null) {
        final calculationData = calculationMatch.group(1) ?? '';
        final baseValueRegex = RegExp(r'Base Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
        final baseMatch = baseValueRegex.firstMatch(calculationData);
        if (baseMatch != null) {
          final valueStr = baseMatch.group(1)?.replaceAll(',', '') ?? '';
          baseValue = double.tryParse(valueStr);
        }
      }
    }
    
    final displayBaseValue = baseValue ?? estimatedValue;
    final currentValue = estimatedValue;

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.black, width: 1),
      columnWidths: {
        0: pw.FixedColumnWidth(90),   // Asset
        1: pw.FixedColumnWidth(140),  // Base Value
        2: pw.FixedColumnWidth(140),  // Current Market Value
        3: pw.FixedColumnWidth(150),  // Location
        4: pw.FixedColumnWidth(100),  // Area
        5: pw.FlexColumnWidth(2),     // Additional Details
      },
      children: [
        // Header row
        pw.TableRow(
          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E0E0E0')),
          children: [
            _buildTableCell('Asset', isHeader: true),
            _buildTableCell('Base Value (LKR)', isHeader: true),
            _buildTableCell('Current Market Value (LKR)', isHeader: true),
            _buildTableCell('Location', isHeader: true),
            _buildTableCell('Area', isHeader: true),
            _buildTableCell('Additional Details', isHeader: true),
          ],
        ),
        // Data row
        pw.TableRow(
          children: [
            _buildTableCell(assetName),
            _buildTableCell(currencyFormatter.format(displayBaseValue)), // Base value (extracted from notes or estimated value)
            _buildTableCell(currencyFormatter.format(currentValue)), // Current value (may include appreciation/depreciation)
            _buildTableCell(location),
            _buildTableCell(area),
            _buildTableCell(additionalDetails),
          ],
        ),
      ],
    );
  }

  /// Builds the intangible / movable assets table used for vehicle and other categories.
  /// Shows the asset type, description, and estimated value.
  static pw.Widget _buildIntangibleAssetsTable(Valuation valuation, NumberFormat currencyFormatter) {
    final estimatedValue = valuation.estimatedValue ?? 0.0;
    final category = valuation.category.toLowerCase();
    String asset = 'Asset';
    String assetDescription = 'Not specified';
    String additionalDetails = 'N/A';

    if (category == 'vehicle') {
      asset = valuation.vehicleMake ?? 'Vehicle';
      final model = valuation.vehicleModel ?? '';
      final year = valuation.vehicleYear?.toString() ?? '';
      assetDescription = '$model $year'.trim();
      final reg = valuation.vehicleRegistrationNumber ?? 'N/A';
      final mileage = valuation.vehicleMileage?.toString() ?? 'N/A';
      final condition = valuation.vehicleCondition ?? 'N/A';
      additionalDetails = 'Registration: $reg, Mileage: $mileage, Condition: $condition';
    } else if (category == 'other') {
      asset = valuation.otherType ?? 'Other Asset';
      assetDescription = valuation.otherSpecifications ?? 'Not specified';
      additionalDetails = valuation.description ?? 'N/A';
    }

    // Extract base value from notes if available
    double? baseValue;
    if (valuation.notes != null && valuation.notes!.isNotEmpty) {
      final notes = valuation.notes!;
      final calculationBlockRegex = RegExp(
        r'\[VALUATION_CALCULATION\](.*?)\[/VALUATION_CALCULATION\]',
        dotAll: true,
        caseSensitive: false,
      );
      final calculationMatch = calculationBlockRegex.firstMatch(notes);
      
      if (calculationMatch != null) {
        final calculationData = calculationMatch.group(1) ?? '';
        final baseValueRegex = RegExp(r'Base Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
        final baseMatch = baseValueRegex.firstMatch(calculationData);
        if (baseMatch != null) {
          final valueStr = baseMatch.group(1)?.replaceAll(',', '') ?? '';
          baseValue = double.tryParse(valueStr);
        }
      }
    }
    
    final displayBaseValue = baseValue ?? estimatedValue;
    final currentValue = estimatedValue;

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.black, width: 1),
      columnWidths: {
        0: pw.FixedColumnWidth(90),   // Asset
        1: pw.FlexColumnWidth(2),     // Description
        2: pw.FixedColumnWidth(140),  // Base Value
        3: pw.FixedColumnWidth(140),  // Current Fair Value
        4: pw.FlexColumnWidth(2.5),   // Additional Details
      },
      children: [
        // Header row
        pw.TableRow(
          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E0E0E0')),
          children: [
            _buildTableCell('Asset', isHeader: true),
            _buildTableCell('Description', isHeader: true),
            _buildTableCell('Base Value (LKR)', isHeader: true),
            _buildTableCell('Current Fair Value (LKR)', isHeader: true),
            _buildTableCell('Additional Details', isHeader: true),
          ],
        ),
        // Data row
        pw.TableRow(
          children: [
            _buildTableCell(asset),
            _buildTableCell(assetDescription),
            _buildTableCell(currencyFormatter.format(displayBaseValue)), // Base value (extracted from notes or estimated value)
            _buildTableCell(currencyFormatter.format(currentValue)), // Current value (may include appreciation/depreciation)
            _buildTableCell(additionalDetails),
          ],
        ),
      ],
    );
  }

  /// Builds the appreciation / depreciation adjustment table that shows:
  /// base value, adjustment type, method, rate, years, and resulting new value.
  /// Only included when the field officer entered calculation data in the form.
  static pw.Widget _buildValuationAdjustmentsTable(Valuation valuation, NumberFormat currencyFormatter) {
    final estimatedValue = valuation.estimatedValue ?? 0.0;
    
    // Try to extract calculation info from notes if available
    String adjustmentType = 'None';
    String adjustmentPercentage = 'N/A';
    double? baseValue;
    double? rateValue;
    
    // Try to find structured calculation information in notes
    if (valuation.notes != null && valuation.notes!.isNotEmpty) {
      final notes = valuation.notes!;
      
      // Look for structured calculation block [VALUATION_CALCULATION]...[/VALUATION_CALCULATION]
      final calculationBlockRegex = RegExp(
        r'\[VALUATION_CALCULATION\](.*?)\[/VALUATION_CALCULATION\]',
        dotAll: true,
        caseSensitive: false,
      );
      final calculationMatch = calculationBlockRegex.firstMatch(notes);
      
      if (calculationMatch != null) {
        // Found structured calculation data
        final calculationData = calculationMatch.group(1) ?? '';
        
        // Extract Base Value
        final baseValueRegex = RegExp(r'Base Value:\s*LKR\s*([\d,]+\.?\d*)', caseSensitive: false);
        final baseMatch = baseValueRegex.firstMatch(calculationData);
        if (baseMatch != null) {
          final valueStr = baseMatch.group(1)?.replaceAll(',', '') ?? '';
          baseValue = double.tryParse(valueStr);
        }
        
        // Extract Adjustment Type
        final typeRegex = RegExp(r'Adjustment Type:\s*(Appreciation|Depreciation|None)', caseSensitive: false);
        final typeMatch = typeRegex.firstMatch(calculationData);
        if (typeMatch != null) {
          final extractedType = typeMatch.group(1);
          if (extractedType != null && extractedType != 'None') {
            adjustmentType = extractedType;
          } else {
            adjustmentType = 'None';
          }
        }
        
        // Extract Rate
        final rateRegex = RegExp(r'Rate:\s*([\d,]+\.?\d*)\s*%', caseSensitive: false);
        final rateMatch = rateRegex.firstMatch(calculationData);
        if (rateMatch != null) {
          final rateStr = rateMatch.group(1)?.replaceAll(',', '') ?? '';
          rateValue = double.tryParse(rateStr);
          if (rateValue != null) {
            adjustmentPercentage = '${rateValue.toStringAsFixed(2)}%';
          }
        }
      } else {
        // Fallback: Try to extract from unstructured notes
        final notesLower = notes.toLowerCase();
        
        // Look for percentage patterns like "5%", "10% appreciation", "rate: 8%", etc.
        final percentagePatterns = [
          RegExp(r'rate[:\s]+(\d+\.?\d*)\s*%', caseSensitive: false),
          RegExp(r'(\d+\.?\d*)\s*%\s*(appreciation|depreciation)', caseSensitive: false),
          RegExp(r'(\d+\.?\d*)\s*%', caseSensitive: false),
        ];
        
        for (var pattern in percentagePatterns) {
          final match = pattern.firstMatch(notes);
          if (match != null) {
            rateValue = double.tryParse(match.group(1) ?? '');
            if (rateValue != null) {
              adjustmentPercentage = '${rateValue.toStringAsFixed(2)}%';
              break;
            }
          }
        }
        
        // Detect adjustment type
        if (notesLower.contains('appreciation') || notesLower.contains('appreciate')) {
          adjustmentType = 'Appreciation';
        } else if (notesLower.contains('depreciation') || notesLower.contains('depreciate')) {
          adjustmentType = 'Depreciation';
        }
        
        // Try to find base value in notes (e.g., "base: 1000000", "base value: 1000000")
        final baseValuePatterns = [
          RegExp(r'base[:\s]+value[:\s]+(?:lkr\s*)?([\d,]+\.?\d*)', caseSensitive: false),
          RegExp(r'base[:\s]+(?:lkr\s*)?([\d,]+\.?\d*)', caseSensitive: false),
          RegExp(r'original[:\s]+(?:lkr\s*)?([\d,]+\.?\d*)', caseSensitive: false),
        ];
        
        for (var pattern in baseValuePatterns) {
          final match = pattern.firstMatch(notes);
          if (match != null) {
            final valueStr = match.group(1)?.replaceAll(',', '') ?? '';
            baseValue = double.tryParse(valueStr);
            if (baseValue != null) break;
          }
        }
      }
    }
    
    // If no base value found in notes, use estimated value (assuming no adjustment was made)
    final displayBaseValue = baseValue ?? estimatedValue;
    final currentValue = estimatedValue;
    
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.black, width: 1),
          columnWidths: {
            0: pw.FixedColumnWidth(90),   // Asset
            1: pw.FixedColumnWidth(140),  // Base Value
            2: pw.FixedColumnWidth(120),  // Adjustment Type
            3: pw.FixedColumnWidth(90),   // Percentage
            4: pw.FixedColumnWidth(140),  // Current Market Value
            5: pw.FixedColumnWidth(140),  // Net Book Value
          },
          children: [
            // Header row
            pw.TableRow(
              decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E0E0E0')),
              children: [
                _buildTableCell('Asset', isHeader: true),
                _buildTableCell('Base Value (LKR)', isHeader: true),
                _buildTableCell('Adjustment Type', isHeader: true),
                _buildTableCell('Rate %', isHeader: true),
                _buildTableCell('Current Market Value (LKR)', isHeader: true),
                _buildTableCell('Net Book Value (LKR)', isHeader: true),
              ],
            ),
            // Data row
            pw.TableRow(
              children: [
                _buildTableCell(valuation.categoryDisplay),
                _buildTableCell(currencyFormatter.format(displayBaseValue)),
                _buildTableCell(adjustmentType),
                _buildTableCell(adjustmentPercentage),
                _buildTableCell(currencyFormatter.format(currentValue)),
                _buildTableCell(currencyFormatter.format(currentValue)),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 8),
        pw.Text(
          '*Note: Base Value represents the original assessment before adjustments. Current Market Value reflects the final calculated value. If appreciation or depreciation adjustments were applied using compound interest methodology, they are reflected in the difference between Base Value and Current Market Value shown above.',
          style: pw.TextStyle(
            fontSize: 9,
            fontStyle: pw.FontStyle.italic,
            color: PdfColor.fromHex('#666666'),
          ),
        ),
      ],
    );
  }

  /// Builds Section V: Valuation Assumptions and Adjustments.
  /// Contains auto-generated professional text describing the assumptions
  /// behind the valuation, specific to each asset category.
  static pw.Widget _buildSectionV(Valuation valuation, String? notes) {
    // Generate assumptions and adjustments text based on category and calculation method
    final assumptionsText = _generateAssumptionsAndAdjustmentsText(valuation, notes);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'V. Valuation Assumptions and Adjustments',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: assumptionsText,
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
      ],
    );
  }

  /// Generates the assumptions paragraph text for Section V.
  /// Produces different text depending on the asset category and whether
  /// an appreciation/depreciation calculation was applied.
  static String _generateAssumptionsAndAdjustmentsText(Valuation valuation, String? notes) {
    // Parse calculation data from notes to determine if appreciation/depreciation was applied
    final calculationData = _parseCalculationDataFromNotes(notes);
    final adjustmentType = calculationData['adjustmentType'];
    final rate = calculationData['rate'];
    final years = calculationData['years'];
    final baseValue = calculationData['baseValue'];
    final calculatedValue = calculationData['calculatedValue'];
    final hasAdjustment = adjustmentType != null && 
                          adjustmentType.toString().toLowerCase() != 'none' && 
                          rate != null && 
                          years != null;

    final category = valuation.category.toLowerCase();
    String assumptionsText = '';

    // Category-specific assumptions
    switch (category) {
      case 'land':
        assumptionsText = 'The following key assumptions were made in determining the land valuation:\n\n';
        assumptionsText += '(1) Market Conditions: The valuation assumes current market conditions prevailing at the time of assessment, including factors such as economic climate, interest rates, and local real estate trends.\n\n';
        assumptionsText += '(2) Location Factors: The location of the land asset was assessed based on accessibility, proximity to amenities, zoning regulations, development potential, and comparable property values in the surrounding area.\n\n';
        
        if (valuation.landType != null && valuation.landType!.isNotEmpty) {
          assumptionsText += '(3) Land Characteristics: The land type (${valuation.landType}) was considered in the valuation, as different land types (residential, commercial, agricultural, etc.) have varying market values and development potential.\n\n';
        }
        
        assumptionsText += '(4) Comparable Sales: Recent sales of similar land parcels in the same or comparable locations were analyzed, with adjustments made for differences in size, location advantages, development potential, and market timing.\n\n';
        assumptionsText += '(5) Market Trends: The valuation considers prevailing market trends, including supply and demand dynamics, planned infrastructure developments, and economic indicators that may affect land values.\n\n';
        assumptionsText += 'The final valuation represents the most probable price that would be agreed upon between a willing buyer and a willing seller in an arm\'s-length transaction, with both parties having reasonable knowledge of the property and market conditions.';
        break;

      case 'building':
        assumptionsText = 'The following key assumptions were made in determining the building valuation:\n\n';
        assumptionsText += '(1) Construction Costs: Current construction costs for similar buildings were considered, including materials, labor, overheads, and applicable building codes and regulations.\n\n';
        assumptionsText += '(2) Depreciation: Physical deterioration, functional obsolescence, and economic obsolescence were assessed based on the building\'s age, condition, design, and market factors.\n\n';
        
        if (valuation.yearBuilt != null) {
          final currentYear = DateTime.now().year;
          final age = currentYear - valuation.yearBuilt!;
          assumptionsText += '(3) Age and Condition: The building\'s age of $age years was factored into the depreciation calculation, along with its current physical condition and maintenance history.\n\n';
        }
        
        if (valuation.numberOfFloors != null) {
          assumptionsText += '(4) Building Features: The number of floors (${valuation.numberOfFloors}) and overall building specifications were considered in determining replacement costs and market comparability.\n\n';
        }
        
        assumptionsText += '(5) Market Conditions: Current market conditions for similar properties were analyzed, including recent sales, rental rates, occupancy levels, and market trends in the area.\n\n';
        assumptionsText += '(6) Location: The building\'s location was assessed for factors such as accessibility, neighborhood quality, proximity to amenities, and potential for future development or appreciation.\n\n';
        assumptionsText += 'The valuation considers both the cost to replace the building and its current market value based on comparable sales and income potential.';
        break;

      case 'vehicle':
        assumptionsText = 'The following key assumptions were made in determining the vehicle valuation:\n\n';
        assumptionsText += '(1) Market Conditions: The valuation assumes current market conditions for vehicles of similar make, model, and age, including supply and demand dynamics in the used vehicle market.\n\n';
        assumptionsText += '(2) Depreciation: Standard depreciation patterns for vehicles were considered, accounting for age, mileage, condition, and market preferences for specific makes and models.\n\n';
        
        if (valuation.vehicleYear != null) {
          final currentYear = DateTime.now().year;
          final age = currentYear - valuation.vehicleYear!;
          assumptionsText += '(3) Age Factor: The vehicle\'s age of $age years was a primary factor, as vehicles depreciate significantly in their early years and continue to decline in value over time.\n\n';
        }
        
        if (valuation.vehicleMileage != null) {
          assumptionsText += '(4) Mileage: The recorded mileage of $valuation.vehicleMileage kilometers/miles was evaluated against typical usage patterns, as higher mileage generally results in lower market value.\n\n';
        }
        
        if (valuation.vehicleCondition != null && valuation.vehicleCondition!.isNotEmpty) {
          assumptionsText += '(5) Condition: The vehicle\'s condition (${valuation.vehicleCondition}) was assessed based on standard condition categories, affecting the final valuation accordingly.\n\n';
        }
        
        assumptionsText += '(6) Market Comparables: Recent sales and listings of comparable vehicles with similar specifications were analyzed to determine the prevailing market value.\n\n';
        assumptionsText += '(7) Market Preferences: Current market preferences for specific makes, models, fuel types, and features were considered, as these can significantly impact resale value.\n\n';
        assumptionsText += 'The valuation reflects the fair market value based on the vehicle\'s specific characteristics and current market conditions.';
        break;

      case 'other':
        final assetType = valuation.otherType != null && valuation.otherType!.isNotEmpty 
            ? valuation.otherType 
            : 'asset';
        assumptionsText = 'The following key assumptions were made in determining the valuation for this $assetType:\n\n';
        assumptionsText += '(1) Asset Classification: The asset was properly classified and evaluated using valuation methodologies appropriate for its specific type and characteristics.\n\n';
        
        if (valuation.otherSpecifications != null && valuation.otherSpecifications!.isNotEmpty) {
          assumptionsText += '(2) Asset Specifications: The asset specifications ($valuation.otherSpecifications) were carefully analyzed to determine the most appropriate valuation approach and assumptions.\n\n';
        }
        
        assumptionsText += '(3) Market Conditions: Current market conditions for similar assets were assessed, including supply and demand dynamics, market trends, and economic factors affecting the asset class.\n\n';
        assumptionsText += '(4) Condition Assessment: The physical and functional condition of the asset was evaluated, considering wear and tear, maintenance history, and remaining useful life.\n\n';
        assumptionsText += '(5) Market Comparables: Comparable assets in the market were analyzed, with adjustments made for differences in specifications, condition, and market timing.\n\n';
        assumptionsText += '(6) Market Value Definition: The valuation assumes fair market value, representing the price that would be agreed upon between a willing buyer and a willing seller in an arm\'s-length transaction, with both parties having reasonable knowledge of the asset and market conditions.';
        break;

      default:
        assumptionsText = 'The following key assumptions were made in determining the asset valuation:\n\n';
        assumptionsText += '(1) Market Conditions: The valuation assumes current market conditions prevailing at the time of assessment, including economic climate, supply and demand dynamics, and market trends.\n\n';
        assumptionsText += '(2) Asset Characteristics: The asset\'s specific characteristics, condition, and specifications were carefully considered in the valuation process.\n\n';
        assumptionsText += '(3) Comparable Assets: Comparable assets in the market were analyzed, with appropriate adjustments made for differences in specifications, condition, and market timing.\n\n';
        assumptionsText += '(4) Fair Market Value: The valuation represents fair market value, defined as the price that would be agreed upon between a willing buyer and a willing seller in an arm\'s-length transaction, with both parties having reasonable knowledge of the asset and market conditions.';
    }

    // Add detailed adjustment explanation if appreciation/depreciation was applied
    if (hasAdjustment) {
      final adjustmentTypeText = adjustmentType.toString().toLowerCase() == 'appreciation' 
          ? 'appreciation' 
          : 'depreciation';
      final adjustmentVerb = adjustmentTypeText == 'appreciation' ? 'increased' : 'decreased';
      final rateText = rate != null ? '$rate%' : '';
      final yearsText = years != null ? years.toString() : '';
      final yearsPlural = years != null && years != 1 ? 's' : '';
      
      assumptionsText += '\n\n\nAppreciation/Depreciation Adjustments:\n\n';
      
      if (baseValue != null && calculatedValue != null) {
        final currencyFormatter = NumberFormat.currency(symbol: 'LKR ', decimalDigits: 2);
        assumptionsText += 'A $adjustmentTypeText adjustment was applied to the base valuation of ${currencyFormatter.format(baseValue)} using the compound interest methodology. ';
        assumptionsText += 'This adjustment accounts for the change in asset value over $yearsText year$yearsPlural at an annual rate of $rateText. ';
        assumptionsText += 'The compound interest method considers the time value of money and the cumulative effect of value changes over the specified period. ';
        assumptionsText += 'As a result of this adjustment, the asset value has $adjustmentVerb from the base value of ${currencyFormatter.format(baseValue)} to a current market value of ${currencyFormatter.format(calculatedValue)}.';
      } else {
        assumptionsText += 'A $adjustmentTypeText adjustment was applied to the base valuation using the compound interest methodology. ';
        assumptionsText += 'This adjustment accounts for the change in asset value over $yearsText year$yearsPlural at an annual rate of $rateText. ';
        assumptionsText += 'The compound interest method considers the time value of money and the cumulative effect of value changes over the specified period, providing a more accurate representation of the asset\'s current market value.';
        assumptionsText += ' Appreciation reflects the increase in asset value over time due to factors such as market demand, inflation, or improvements, while depreciation accounts for the decrease in value due to wear and tear, obsolescence, or market factors.';
      }
      
      assumptionsText += '\n\nThese adjustments are reflected in the Current Market Value shown in Section IV (Asset Details).';
    } else {
      // No adjustment was applied, but still mention that adjustments could be applied
      assumptionsText += '\n\n\nValuation Adjustments:\n\n';
      assumptionsText += 'No appreciation or depreciation adjustments were applied to this valuation. The current market value represents the base assessment of the asset. If future adjustments are required due to changes in market conditions, asset condition, or other relevant factors, they would be calculated using appropriate methodologies (such as compound interest for time-based value changes) and documented accordingly.';
    }

    return assumptionsText;
  }

  /// Builds Section VI: Supporting Documentation.
  /// Embeds the evidence photos as a grid of 100×100 thumbnails and includes
  /// a paragraph describing the types of documentation collected.
  static pw.Widget _buildSectionVI(Valuation valuation, String? notes, List<pw.Widget> photoWidgets) {
    // Generate supporting documentation text based on category and available evidence
    final supportingText = _generateSupportingDocumentationText(valuation, notes, photoWidgets.length);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'VI. Supporting Documentation',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: supportingText,
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
        if (photoWidgets.isNotEmpty) ...[
          pw.SizedBox(height: 15),
          pw.Text(
            'Photographs:',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
          pw.SizedBox(height: 10),
          pw.Wrap(
            spacing: 10,
            runSpacing: 10,
            children: photoWidgets,
          ),
        ],
      ],
    );
  }

  /// Generates the supporting documentation paragraph for Section VI.
  /// Describes what physical evidence was gathered for this specific asset
  /// category and how many photos are included in the report.
  static String _generateSupportingDocumentationText(Valuation valuation, String? notes, int photoCount) {
    // Clean notes by removing calculation block
    final cleanedNotes = _cleanNotesForDisplay(notes);
    
    final category = valuation.category.toLowerCase();
    String documentationText = '';

    // Category-specific documentation descriptions
    switch (category) {
      case 'land':
        documentationText = 'The following supporting documentation and evidence were collected and reviewed as part of this land valuation:\n\n';
        
        if (photoCount > 0) {
          final photoText = photoCount != 1 ? 's were' : ' was';
          documentationText += '(1) Photographic Evidence: $photoCount photograph$photoText captured during the site inspection, documenting the current condition of the land, its physical characteristics, boundaries, topography, and surrounding environment. These photographs provide visual evidence of the land\'s state and support the valuation assessment.\n\n';
        } else {
          documentationText += '(1) Photographic Evidence: Site photographs documenting the land\'s condition, boundaries, and physical characteristics.\n\n';
        }
        
        if (valuation.landLatitude != null && valuation.landLongitude != null) {
          documentationText += '(2) Location Data: Precise geographic coordinates (latitude: ${valuation.landLatitude}, longitude: ${valuation.landLongitude}) were recorded to accurately identify and map the property location. This location data enables verification through mapping services and supports location-based valuation considerations.\n\n';
        } else if (valuation.landLocation != null && valuation.landLocation!.isNotEmpty) {
          documentationText += '(2) Location Information: The property location ($valuation.landLocation) was documented and verified to support location-based valuation factors.\n\n';
        }
        
        if (valuation.landArea != null) {
          documentationText += '(3) Area Measurements: The total land area of $valuation.landArea square units was measured and documented, providing the basis for per-unit value calculations and comparisons with similar properties.\n\n';
        }
        
        if (valuation.landType != null && valuation.landType!.isNotEmpty) {
          documentationText += '(4) Land Classification: The land type classification ($valuation.landType) was documented, as different land types have varying market values, development potential, and regulatory considerations.\n\n';
        }
        
        documentationText += '(5) Market Research: Market research was conducted to identify comparable land sales in the area, including analysis of recent transactions, market trends, and pricing patterns for similar properties.\n\n';
        documentationText += '(6) Field Inspection Notes: Detailed observations from the on-site inspection, including notes on accessibility, terrain, existing infrastructure, and any notable features that may affect the property\'s value.\n\n';
        
        if (cleanedNotes.isNotEmpty) {
          documentationText += '(7) Additional Documentation: $cleanedNotes\n\n';
        }
        
        documentationText += 'This comprehensive documentation provides a solid foundation for the valuation and ensures transparency and verifiability of the assessment process.';
        break;

      case 'building':
        documentationText = 'The following supporting documentation and evidence were collected and reviewed as part of this building valuation:\n\n';
        
        if (photoCount > 0) {
          final photoText = photoCount != 1 ? 's were' : ' was';
          documentationText += '(1) Photographic Evidence: $photoCount photograph$photoText captured during the building inspection, documenting the exterior and interior condition, structural elements, fixtures, finishes, and overall state of the property. These photographs provide visual evidence of the building\'s condition and support the valuation assessment.\n\n';
        } else {
          documentationText += '(1) Photographic Evidence: Building photographs documenting the structure\'s exterior, interior, condition, and key features.\n\n';
        }
        
        if (valuation.buildingLatitude != null && valuation.buildingLongitude != null) {
          documentationText += '(2) Location Data: Precise geographic coordinates (latitude: ${valuation.buildingLatitude}, longitude: ${valuation.buildingLongitude}) were recorded to accurately identify and map the building location. This location data enables verification through mapping services and supports location-based valuation considerations.\n\n';
        } else if (valuation.buildingLocation != null && valuation.buildingLocation!.isNotEmpty) {
          documentationText += '(2) Location Information: The building location ($valuation.buildingLocation) was documented and verified to support location-based valuation factors.\n\n';
        }
        
        if (valuation.buildingArea != null) {
          documentationText += '(3) Area Measurements: The total building area of $valuation.buildingArea square units was measured and documented, providing the basis for per-unit value calculations and comparisons with similar properties.\n\n';
        }
        
        if (valuation.numberOfFloors != null) {
          final floorsText = valuation.numberOfFloors != 1 ? 's' : '';
          documentationText += '(4) Building Specifications: The building structure consists of ${valuation.numberOfFloors} floor$floorsText, which was documented as a key structural characteristic affecting the valuation.\n\n';
        }
        
        if (valuation.yearBuilt != null) {
          final currentYear = DateTime.now().year;
          final age = currentYear - valuation.yearBuilt!;
          documentationText += '(5) Construction Details: The building was constructed in ${valuation.yearBuilt} (approximately $age years ago), with this information used to assess depreciation, condition, and remaining useful life.\n\n';
        }
        
        if (valuation.buildingType != null && valuation.buildingType!.isNotEmpty) {
          documentationText += '(6) Building Classification: The building type ($valuation.buildingType) was documented, as different building types (residential, commercial, industrial, etc.) have varying construction costs, market values, and depreciation patterns.\n\n';
        }
        
        documentationText += '(7) Condition Assessment: A comprehensive assessment of the building\'s physical condition, including structural integrity, maintenance state, and any visible defects or required repairs.\n\n';
        documentationText += '(8) Market Research: Market research was conducted to identify comparable building sales and rentals in the area, including analysis of recent transactions, construction costs, and market trends.\n\n';
        
        if (cleanedNotes.isNotEmpty) {
          documentationText += '(9) Additional Documentation: $cleanedNotes\n\n';
        }
        
        documentationText += 'This comprehensive documentation provides a solid foundation for the valuation and ensures transparency and verifiability of the assessment process.';
        break;

      case 'vehicle':
        documentationText = 'The following supporting documentation and evidence were collected and reviewed as part of this vehicle valuation:\n\n';
        
        if (photoCount > 0) {
          final photoText = photoCount != 1 ? 's were' : ' was';
          documentationText += '(1) Photographic Evidence: $photoCount photograph$photoText captured of the vehicle, documenting its exterior condition, interior features, overall appearance, and any notable damage or wear. These photographs provide visual evidence of the vehicle\'s condition and support the valuation assessment.\n\n';
        } else {
          documentationText += '(1) Photographic Evidence: Vehicle photographs documenting the exterior, interior, condition, and key features.\n\n';
        }
        
        if (valuation.vehicleMake != null && valuation.vehicleMake!.isNotEmpty && 
            valuation.vehicleModel != null && valuation.vehicleModel!.isNotEmpty) {
          documentationText += '(2) Vehicle Identification: The vehicle was identified as a $valuation.vehicleMake $valuation.vehicleModel, with this information verified against registration documents.\n\n';
        }
        
        if (valuation.vehicleYear != null) {
          documentationText += '(3) Model Year: The vehicle\'s model year (${valuation.vehicleYear}) was documented, as this is a critical factor in determining depreciation and market value.\n\n';
        }
        
        if (valuation.vehicleRegistrationNumber != null && valuation.vehicleRegistrationNumber!.isNotEmpty) {
          documentationText += '(4) Registration Verification: The vehicle registration number ($valuation.vehicleRegistrationNumber) was verified to ensure legal compliance and ownership documentation.\n\n';
        }
        
        if (valuation.vehicleMileage != null) {
          documentationText += '(5) Mileage Records: The vehicle\'s odometer reading of $valuation.vehicleMileage kilometers/miles was recorded, as mileage is a primary factor in determining depreciation and market value.\n\n';
        }
        
        if (valuation.vehicleCondition != null && valuation.vehicleCondition!.isNotEmpty) {
          documentationText += '(6) Condition Assessment: A detailed assessment of the vehicle\'s condition (${valuation.vehicleCondition}) was conducted, evaluating the vehicle against standard condition categories and noting any defects or required repairs.\n\n';
        }
        
        documentationText += '(7) Market Research: Market research was conducted to identify comparable vehicle sales and listings, including analysis of recent transactions, market prices for similar makes and models, and current market trends.\n\n';
        documentationText += '(8) Maintenance History: Review of available maintenance and service records, if provided, to assess the vehicle\'s maintenance history and its impact on value.\n\n';
        
        if (cleanedNotes.isNotEmpty) {
          documentationText += '(9) Additional Documentation: $cleanedNotes\n\n';
        }
        
        documentationText += 'This comprehensive documentation provides a solid foundation for the valuation and ensures transparency and verifiability of the assessment process.';
        break;

      case 'other':
        final assetType = valuation.otherType != null && valuation.otherType!.isNotEmpty 
            ? valuation.otherType 
            : 'asset';
        documentationText = 'The following supporting documentation and evidence were collected and reviewed as part of this $assetType valuation:\n\n';
        
        if (photoCount > 0) {
          final photoText = photoCount != 1 ? 's were' : ' was';
          documentationText += '(1) Photographic Evidence: $photoCount photograph$photoText captured of the asset, documenting its physical condition, features, and characteristics. These photographs provide visual evidence of the asset\'s state and support the valuation assessment.\n\n';
        } else {
          documentationText += '(1) Photographic Evidence: Asset photographs documenting the item\'s condition, features, and key characteristics.\n\n';
        }
        
        if (valuation.otherSpecifications != null && valuation.otherSpecifications!.isNotEmpty) {
          documentationText += '(2) Asset Specifications: Detailed specifications ($valuation.otherSpecifications) were documented to accurately describe the asset and support valuation comparisons.\n\n';
        }
        
        documentationText += '(3) Asset Identification: Proper identification and classification of the asset type to ensure appropriate valuation methodologies are applied.\n\n';
        documentationText += '(4) Condition Assessment: A comprehensive assessment of the asset\'s physical condition, functionality, and remaining useful life.\n\n';
        documentationText += '(5) Market Research: Market research was conducted to identify comparable assets and transactions, including analysis of recent sales, market prices, and current market trends for similar items.\n\n';
        documentationText += '(6) Documentation Review: Review of any available documentation related to the asset, including purchase records, maintenance history, warranties, or certificates of authenticity where applicable.\n\n';
        
        if (cleanedNotes.isNotEmpty) {
          documentationText += '(7) Additional Documentation: $cleanedNotes\n\n';
        }
        
        documentationText += 'This comprehensive documentation provides a solid foundation for the valuation and ensures transparency and verifiability of the assessment process.';
        break;

      default:
        documentationText = 'The following supporting documentation and evidence were collected and reviewed as part of this asset valuation:\n\n';
        
        if (photoCount > 0) {
          final photoText = photoCount != 1 ? 's were' : ' was';
          documentationText += '(1) Photographic Evidence: $photoCount photograph$photoText captured during the asset inspection, providing visual documentation of the asset\'s condition and characteristics.\n\n';
        }
        
        documentationText += '(2) Asset Information: Comprehensive details about the asset, including its specifications, condition, and relevant characteristics.\n\n';
        documentationText += '(3) Market Research: Market research was conducted to identify comparable assets and transactions, supporting the valuation assessment.\n\n';
        documentationText += '(4) Field Inspection: Observations and notes from the on-site inspection, documenting relevant factors that may affect the asset\'s value.\n\n';
        
        if (cleanedNotes.isNotEmpty) {
          documentationText += '(5) Additional Documentation: $cleanedNotes\n\n';
        }
        
        documentationText += 'This documentation provides a foundation for the valuation and ensures transparency in the assessment process.';
    }

    return documentationText;
  }

  /// Builds Section VII: Conclusion and Certification.
  /// States the final estimated value in LKR and provides a sign-off block
  /// with the field officer's name, designation, and signature line.
  static pw.Widget _buildSectionVII(String? notes, Valuation valuation) {
    final currencyFormatter = NumberFormat.currency(symbol: 'LKR ', decimalDigits: 2);
    final dateFormat = DateFormat('MMMM dd, yyyy');
    final estimatedValue = valuation.estimatedValue ?? 0.0;
    final preparedBy = valuation.fieldOfficerName ?? valuation.fieldOfficerUsername;
    final valuationDate = dateFormat.format(valuation.createdAt);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'VII. Conclusion and Certification',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: 'Based on the comprehensive valuation assessment, the fair market value of the asset has been determined as ${currencyFormatter.format(estimatedValue)} as of $valuationDate.',
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: 'I, $preparedBy, hereby certify that the information presented in this report is accurate to the best of my knowledge and complies with relevant accounting standards and regulations.',
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
        pw.SizedBox(height: 20),
        pw.Text(
          'Prepared by: $preparedBy\nDate: $valuationDate',
          style: pw.TextStyle(
            fontSize: 10,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
      ],
    );
  }

  /// Builds Section VIII: Distribution List.
  /// Lists the people who should receive a copy of this report
  /// (client, project manager, accessor, company archive).
  static pw.Widget _buildSectionVIII(Project project) {
    // Build list of recipients
    final recipients = <String>[];
    
    // Coordinator (always present)
    final coordinatorName = project.coordinatorName ?? project.coordinatorUsername;
    recipients.add('Project Coordinator: $coordinatorName');
    
    // Client (if assigned)
    if (project.assignedClientName != null || project.assignedClientUsername != null) {
      final clientName = project.assignedClientName ?? project.assignedClientUsername ?? 'N/A';
      recipients.add('Client: $clientName');
    }
    
    // Senior Valuer (if assigned)
    if (project.assignedSeniorValuerName != null || project.assignedSeniorValuerUsername != null) {
      final seniorValuerName = project.assignedSeniorValuerName ?? project.assignedSeniorValuerUsername ?? 'N/A';
      recipients.add('Senior Valuer: $seniorValuerName');
    }
    
    // Note: Agent is NOT included in distribution as per requirements
    
    // Accessor (if assigned)
    if (project.assignedAccessorName != null || project.assignedAccessorUsername != null) {
      final accessorName = project.assignedAccessorName ?? project.assignedAccessorUsername ?? 'N/A';
      recipients.add('Accessor: $accessorName');
    }
    
    // Build distribution text
    String distributionText = 'This valuation report will be distributed to the following parties:\n\n';
    for (var recipient in recipients) {
      distributionText += '$recipient\n';
    }
    distributionText += '\nThe report is provided to ensure transparency and facilitate informed decision-making.';

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          'VIII. Distribution',
          style: pw.TextStyle(
            fontSize: 13,
            fontWeight: pw.FontWeight.bold,
          ),
        ),
        pw.SizedBox(height: 15),
        pw.Paragraph(
          text: distributionText,
          textAlign: pw.TextAlign.justify,
          style: pw.TextStyle(
            fontSize: 10,
            lineSpacing: 1.6,
          ),
        ),
      ],
    );
  }

  /// Builds the page footer with company name, confidentiality notice, and page number.
  static pw.Widget _buildFooter() {
    return pw.Container(
      alignment: pw.Alignment.center,
      padding: pw.EdgeInsets.only(top: 20),
      decoration: pw.BoxDecoration(
        border: pw.Border(
          top: pw.BorderSide(
            color: PdfColors.black,
            width: 1,
          ),
        ),
      ),
      child: pw.Text(
        'Auditra Valuation Management System',
        style: pw.TextStyle(
          fontSize: 9,
          color: PdfColor.fromHex('#0066cc'),
        ),
      ),
    );
  }

  /// Creates a single two-column row used inside the general-info table.
  /// [label] is the left column (e.g. "Client Name:"), [value] is the right column.
  static pw.TableRow _buildInfoTableRow(String label, String value) {
    return pw.TableRow(
      children: [
        pw.Container(
          padding: pw.EdgeInsets.all(8),
          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#F9F9F9')),
          child: pw.Text(
            label,
            style: pw.TextStyle(
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ),
        pw.Container(
          padding: pw.EdgeInsets.all(8),
          child: pw.Text(
            value,
            style: pw.TextStyle(fontSize: 10),
          ),
        ),
      ],
    );
  }

  /// Creates a single PDF table cell with optional bold header styling.
  static pw.Widget _buildTableCell(String text, {bool isHeader = false}) {
    return pw.Container(
      padding: pw.EdgeInsets.all(8),
      decoration: isHeader 
          ? pw.BoxDecoration(color: PdfColor.fromHex('#E0E0E0'))
          : null,
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 9,
          fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal,
        ),
      ),
    );
  }

  /// Opens the device's share / print sheet so the user can send or print the PDF.
  /// [subject] is used as the email subject line when sharing via email.
  static Future<void> sharePdf(File pdfFile, {String? subject}) async {
    final bytes = await pdfFile.readAsBytes();
    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => bytes,
    );
  }

  /// Opens the PDF file using the device's default PDF viewer app.
  static Future<void> saveAndOpenPdf(File pdfFile) async {
    await Printing.sharePdf(
      bytes: await pdfFile.readAsBytes(),
      filename: pdfFile.path.split('/').last,
    );
  }
}
