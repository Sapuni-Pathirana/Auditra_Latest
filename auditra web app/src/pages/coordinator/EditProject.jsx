import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Alert,
  IconButton, LinearProgress, Divider, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProjectDetailsFields from '../../components/ProjectDetailsFields';
import { extractApiErrorMessage, formatFileSize } from '../../utils/helpers';
import { useDocumentManagement } from '../../hooks/useDocumentManagement';

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    start_date: '',
    end_date: '',
    estimated_value: '',
  });

  // Use document management hook
  const {
    stagedDocuments,
    existingDocuments,
    uploadingDocs,
    deletingDocId,
    error: docError,
    handleAddDocument,
    handleRemoveStagedDoc,
    handleUploadNewDocuments,
    handleDeleteDocument,
    initializeDocuments,
    setError: setDocError,
  } = useDocumentManagement(id);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await projectService.getProject(id);
        const p = res.data;
        setForm({
          title: p.title || '',
          description: p.description || '',
          priority: p.priority || 'medium',
          start_date: p.start_date || '',
          end_date: p.end_date || '',
          estimated_value: p.estimated_value || '',
        });
        initializeDocuments(p.documents || []);
      } catch {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id, initializeDocuments]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (form.start_date && form.end_date) {
      const startDate = new Date(form.start_date);
      const endDate = new Date(form.end_date);
      if (endDate <= startDate) {
        setError('End date must be after start date');
        setSaving(false);
        return;
      }
    }

    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      estimated_value: parseFloat(form.estimated_value) || 0,
    };

    try {
      await projectService.updateProject(id, payload);
      navigate(`/dashboard/projects/${id}`);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to update project'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/dashboard/projects/${id}`)} sx={{ mb: 2 }}>
        Back to Project
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Edit Project</Typography>
      {(error || docError) && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error || docError}</Alert>}
      <form onSubmit={handleSubmit}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Project Details</Typography>
            <ProjectDetailsFields
              form={form}
              onChange={handleChange}
              startDateMin={undefined}
              endDateMin={form.start_date || undefined}
              endDateError={form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)}
              endDateHelperText={form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date) ? 'End date must be after start date' : ''}
            />
          </CardContent>
        </Card>

        {/* Project Documents */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Project Documents</Typography>

            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                  Current Documents
                </Typography>
                {existingDocuments.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      mb: 1,
                      bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <DescriptionIcon color="primary" fontSize="small" />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{doc.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatFileSize(doc.file_size)}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View">
                        <IconButton size="small" href={doc.file_url} target="_blank" component="a">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={deletingDocId === doc.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {existingDocuments.length > 0 && stagedDocuments.length > 0 && <Divider sx={{ my: 2 }} />}

            {/* Upload new */}
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              size="small"
              sx={{ mb: stagedDocuments.length > 0 ? 2 : 0 }}
            >
              Add Files
              <input type="file" hidden multiple onChange={handleAddDocument} />
            </Button>

            {stagedDocuments.length > 0 && (
              <>
                {stagedDocuments.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      mb: 1,
                      bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionIcon color="action" fontSize="small" />
                      <Typography variant="body2">{doc.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({(doc.file.size / 1024).toFixed(1)} KB)
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => handleRemoveStagedDoc(doc.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleUploadNewDocuments}
                  disabled={uploadingDocs}
                  sx={{ mt: 1 }}
                >
                  {uploadingDocs ? 'Uploading...' : `Upload ${stagedDocuments.length} File(s)`}
                </Button>
                {uploadingDocs && <LinearProgress sx={{ mt: 1 }} />}
              </>
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate(`/dashboard/projects/${id}`)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </Box>
      </form>
    </Box>
  );
}
