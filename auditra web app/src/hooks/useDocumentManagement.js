import { useState, useCallback } from 'react';
import projectService from '../services/projectService';

/**
 * Custom hook for managing document uploads, deletions, and staging
 * Provides consistent error handling and state management across pages
 *
 * @param {number|string} projectId - The project ID to associate documents with
 * @returns {Object} Document management state and handlers
 */
export function useDocumentManagement(projectId) {
  // State for documents being staged for upload
  const [stagedDocuments, setStagedDocuments] = useState([]);

  // State for documents already uploaded to the project
  const [existingDocuments, setExistingDocuments] = useState([]);

  // UI state flags
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [error, setError] = useState('');

  /**
   * Add files to staging area
   * Generates unique IDs and extracts file names without extensions
   */
  const handleAddDocument = useCallback((e) => {
    const files = Array.from(e.target.files);
    const newDocs = files.map((file) => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ''),
      id: crypto.randomUUID(),
    }));
    setStagedDocuments((prev) => [...prev, ...newDocs]);
    e.target.value = ''; // Reset input to allow re-selecting same file
  }, []);

  /**
   * Update a staged document's display name
   */
  const handleDocNameChange = useCallback((docId, newName) => {
    setStagedDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, name: newName } : d))
    );
  }, []);

  /**
   * Remove a document from the staging queue
   */
  const handleRemoveStagedDoc = useCallback((docId) => {
    setStagedDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  /**
   * Upload all staged documents and refresh existing documents list
   * Provides granular error handling per document
   */
  const handleUploadNewDocuments = useCallback(
    async (onSuccess = null) => {
      if (stagedDocuments.length === 0) return;

      setUploadingDocs(true);
      setError('');

      let uploadCount = 0;
      let failureCount = 0;

      for (const doc of stagedDocuments) {
        try {
          await projectService.uploadDocument({
            project: projectId,
            file: doc.file,
            name: doc.name,
          });
          uploadCount += 1;
        } catch (err) {
          failureCount += 1;
          setError(`Failed to upload: ${doc.name}`);
        }
      }

      // Refresh existing documents after upload
      try {
        const res = await projectService.getProject(projectId);
        setExistingDocuments(res.data.documents || []);
      } catch (err) {
        console.error('Failed to refresh documents:', err);
      }

      setStagedDocuments([]);
      setUploadingDocs(false);

      // Callback with upload results
      if (onSuccess) {
        onSuccess({ uploadCount, failureCount });
      }

      return { uploadCount, failureCount };
    },
    [projectId, stagedDocuments]
  );

  /**
   * Delete an existing document by ID
   * Updates local state and handles errors gracefully
   */
  const handleDeleteDocument = useCallback(
    async (docId) => {
      setDeletingDocId(docId);
      setError('');

      try {
        await projectService.deleteDocument(docId);
        setExistingDocuments((prev) => prev.filter((d) => d.id !== docId));
      } catch (err) {
        setError('Failed to delete document');
      } finally {
        setDeletingDocId(null);
      }
    },
    []
  );

  /**
   * Initialize with existing documents (call from useEffect on mount)
   */
  const initializeDocuments = useCallback((docs) => {
    setExistingDocuments(docs || []);
  }, []);

  return {
    // State
    stagedDocuments,
    existingDocuments,
    uploadingDocs,
    deletingDocId,
    error,

    // State setters (for manual control if needed)
    setError,
    setStagedDocuments,
    setExistingDocuments,

    // Handlers
    handleAddDocument,
    handleDocNameChange,
    handleRemoveStagedDoc,
    handleUploadNewDocuments,
    handleDeleteDocument,
    initializeDocuments,
  };
}
