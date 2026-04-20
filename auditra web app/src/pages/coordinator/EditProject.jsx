import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid, Alert, MenuItem,
  InputAdornment, IconButton, LinearProgress, Divider, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';

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

  // Document states
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [stagedDocuments, setStagedDocuments] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);

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
        setExistingDocuments(p.documents || []);
      } catch {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Document handlers
  const handleAddDocument = (e) => {
    const files = Array.from(e.target.files);
    const newDocs = files.map(file => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ''),
      id: crypto.randomUUID(),
    }));
    setStagedDocuments(prev => [...prev, ...newDocs]);
    e.target.value = '';
  };

  const handleRemoveStagedDoc = (docId) => {
    setStagedDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleUploadNewDocuments = async () => {
    if (stagedDocuments.length === 0) return;
    setUploadingDocs(true);
    setError('');
    for (const doc of stagedDocuments) {
      try {
        await projectService.uploadDocument({
          project: id,
          file: doc.file,
          name: doc.name,
        });
      } catch {
        setError(`Failed to upload: ${doc.name}`);
      }
    }
    setStagedDocuments([]);
    try {
      const res = await projectService.getProject(id);
      setExistingDocuments(res.data.documents || []);
    } catch {}
    setUploadingDocs(false);
  };

  const handleDeleteDocument = async (docId) => {
    setDeletingDocId(docId);
    setError('');
    try {
      await projectService.deleteDocument(docId);
      setExistingDocuments(prev => prev.filter(d => d.id !== docId));
    } catch {
      setError('Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        if (data.error) {
          setError(data.error);
        } else if (data.detail) {
          setError(data.detail);
        } else if (data.message) {
          setError(data.message);
        } else {
          const msgs = Object.entries(data).map(([k, v]) => {
            const fieldName = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const message = Array.isArray(v) ? v.join(', ') : v;
            return `${fieldName}: ${message}`;
          });
          setError(msgs.join('\n'));
        }
      } else {
        setError(err.message || 'Failed to update project');
      }
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
      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Project Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Project Title" name="title" value={form.title} onChange={handleChange} required /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Description" name="description" value={form.description} onChange={handleChange} multiline rows={3} required /></Grid>
              <Grid item xs={12} sm={4}>
                <TextField select fullWidth label="Priority" name="priority" value={form.priority} onChange={handleChange}>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth label="Start Date" name="start_date" type="date" value={form.start_date} onChange={handleChange} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="End Date"
                  name="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: form.start_date || undefined }}
                  error={form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)}
                  helperText={form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date) ? 'End date must be after start date' : ''}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Estimated Value (LKR)"
                  name="estimated_value"
                  type="number"
                  value={form.estimated_value}
                  onChange={handleChange}
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
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
