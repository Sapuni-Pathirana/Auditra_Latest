
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import '../../../../models/project_model.dart';
import '../../../../services/network_service.dart';

/// A helper class that manages project documents for the field officer.
///
/// It handles three things:
///   1. Checking whether a document has already been downloaded to the device.
///   2. Downloading a document from the server and saving it locally.
///   3. Opening a locally saved document in the device's file viewer.
///
/// Documents are stored in the app's private folder under `project_docs/`.
/// Each saved file is named `{id}_{originalName}` so it can be found again later.
class FieldOfficerDocumentManager {
  final BuildContext context;             // Needed to show snack bars and dialogs
  final Function(void Function()) setState; // Calls setState on the parent widget to refresh the UI
  final Set<int> downloadedDocuments = {}; // In-memory cache of document IDs already downloaded this session

  FieldOfficerDocumentManager({
    required this.context,
    required this.setState,
  });

  /// Checks whether the document with [docId] is already saved on this device.
  ///
  /// First checks the in-memory cache (fast). If not found there,
  /// it looks for the file on disk. If the file exists on disk,
  /// it adds the ID to the cache so future checks are instant.
  ///
  /// Returns `true` if the file exists locally, `false` otherwise.
  Future<bool> isDocumentDownloaded(int docId) async {
    // Fast path: already confirmed downloaded this session
    if (downloadedDocuments.contains(docId)) return true;
    
    final filePath = await getLocalFilePath(docId);
    if (filePath != null && File(filePath).existsSync()) {
      // File found on disk — add to cache so we don't need to scan again
      setState(() {
        downloadedDocuments.add(docId);
      });
      return true;
    }
    return false; // Not downloaded yet
  }

  /// Looks for a previously downloaded file for [docId] on the device's storage.
  ///
  /// Files are stored in `<app documents>/project_docs/` and named `{docId}_{filename}`.
  /// This function scans that folder for any file whose name starts with `{docId}_`.
  ///
  /// Returns the full file path if found, or `null` if the file does not exist yet.
  Future<String?> getLocalFilePath(int docId) async {
    try {
      // Get the app's private documents directory (not visible to other apps)
      final directory = await getApplicationDocumentsDirectory();
      final docsDir = Directory('${directory.path}/project_docs');
      if (!await docsDir.exists()) {
        // Create the folder the first time this runs
        await docsDir.create(recursive: true);
      }
      
      // Find file with this ID prefix
      if (await docsDir.exists()) {
        await for (final entity in docsDir.list()) {
          if (entity is File) {
            final filename = entity.path.split(Platform.pathSeparator).last;
            // File names are saved as "{docId}_{originalName}", so we match by prefix
            if (filename.startsWith('${docId}_')) {
              return entity.path; // Found the file — return its full path
            }
          }
        }
      }
      return null; // File not found on disk
    } catch (e) {
      print('Error getting local file path: $e');
      return null;
    }
  }

  /// Opens a locally saved file in the device's default viewer app.
  ///
  /// For example, a PDF will open in the PDF viewer, a Word document
  /// will open in the document viewer, etc.
  ///
  /// Shows an error snack bar if the device cannot find a suitable app
  /// to open the file.
  Future<void> viewDownloadedDocument(String filePath) async {
    try {
      final result = await OpenFile.open(filePath); // Ask the OS to open the file
      if (result.type != ResultType.done) {
        // OS returned an error (e.g. no app installed to handle this file type)
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Could not open file: ${result.message}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      // Unexpected error (e.g. file was deleted between download and open)
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error opening file: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Downloads a project document from the server and saves it to the device.
  ///
  /// Steps:
  ///   1. Check for internet — if offline, show an orange warning and stop.
  ///   2. Show a "Downloading..." blue snack bar so the user knows something is happening.
  ///   3. Fetch the file bytes from the document's URL via an HTTP GET request.
  ///   4. Save the bytes to `project_docs/{docId}_{safeName}` in the app's documents folder.
  ///   5. Add the doc ID to the in-memory cache and show a "Download complete" message.
  ///   6. Offer an "OPEN" button so the user can view the file immediately.
  ///   7. If anything goes wrong (network error, disk error), show a red error snack bar.
  Future<void> downloadDocument(ProjectDocument doc) async {
    // Step 1 — Check network before doing anything
    if (!await NetworkService.checkConnectivity()) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No internet connection. Cannot download document.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      return; // Stop here — cannot download without internet
    }

    // Step 2 — Show a brief "Downloading..." message while the request runs
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Downloading ${doc.name}...'),
          backgroundColor: Colors.blue,
          duration: const Duration(seconds: 1),
        ),
      );
    }

    try {
      // Step 3 — Fetch the raw file bytes from the server URL
      final response = await http.get(Uri.parse(doc.fileUrl!));
      
      if (response.statusCode == 200) {
        // Step 4 — Save the downloaded bytes to the local project_docs folder
        final directory = await getApplicationDocumentsDirectory();
        final docsDir = Directory('${directory.path}/project_docs');
        if (!await docsDir.exists()) {
          await docsDir.create(recursive: true); // Create folder if it does not exist yet
        }
        
        // Clean filename logic could go here, for now using simple replacement
        // Strip any special characters that could cause problems in a file path
        final safeName = doc.name.replaceAll(RegExp(r'[^\w\s\.-]'), '');
        // Prefix the file with the document ID so getLocalFilePath can find it later
        final filePath = '${docsDir.path}/${doc.id}_$safeName';
        
        final file = File(filePath);
        await file.writeAsBytes(response.bodyBytes); // Write raw bytes to disk
        
        // Step 5 — Mark as downloaded in the in-memory cache so the UI updates
        setState(() {
          downloadedDocuments.add(doc.id);
        });
        
        if (context.mounted) {
          // Show a green success message
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Download complete'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
          
          // Step 6 — Offer an "OPEN" action button so the user can view it right away
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Document downloaded'),
              action: SnackBarAction(
                label: 'OPEN',
                textColor: Colors.white,
                onPressed: () => viewDownloadedDocument(filePath),
              ),
            ),
          );
        }
      } else {
        // Server responded with a non-200 code (e.g. 404 Not Found, 403 Forbidden)
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      // Step 7 — Show a red error message for any network or disk failure
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
