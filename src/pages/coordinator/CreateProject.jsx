import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid, Alert, MenuItem,
  CircularProgress, InputAdornment, IconButton, LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import projectService from '../../services/projectService';

export default function CreateProject() {
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill from assigned submission (passed via route state from AssignedSubmissions)
  const submissionData = location.state?.submissionData || null;
  const submissionId = location.state?.submissionId || null;

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState({
    title: submissionData?.project_title || '',
    description: submissionData?.project_description || '',
    priority: 'medium',
    start_date: '',
    end_date: '',
    estimated_value: '50000',
    client_name: submissionData
      ? [submissionData.first_name, submissionData.last_name].filter(Boolean).join(' ')
      : '',
    client_email: submissionData?.email || '',
    client_phone: submissionData?.phone || '',
    client_address: submissionData?.address || '',
    client_company: submissionData?.company_name || '',
    agent_name: submissionData?.agent_name || '',
    agent_email: submissionData?.agent_email || '',
    agent_phone: submissionData?.agent_phone || '',
    agent_address: '',
    agent_license_number: '',
  });

  // Email check states
  const [clientEmailStatus, setClientEmailStatus] = useState(null); // null | 'checking' | 'found' | 'not_found' | 'mismatch' | 'error'
  const [clientEmailMessage, setClientEmailMessage] = useState('');
  const [agentEmailStatus, setAgentEmailStatus] = useState(null);
  const [agentEmailMessage, setAgentEmailMessage] = useState('');

  // Document staging states
  const [stagedDocuments, setStagedDocuments] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidSLPhone = (phone) => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    // +94XXXXXXXXX (12 chars) or 0XXXXXXXXX (10 chars)
    return /^\+94\d{9}$/.test(cleaned) || /^0\d{9}$/.test(cleaned);
  };

  const today = new Date().toISOString().split('T')[0];

  const validateForm = () => {
    const errors = {};

    // Date validations
    if (!form.start_date) {
      errors.start_date = 'Start date is required';
    } else if (form.start_date < today) {
      errors.start_date = 'Start date must be today or a future date';
    }

    if (!form.end_date) {
      errors.end_date = 'End date is required';
    } else if (form.start_date && form.end_date <= form.start_date) {
      errors.end_date = 'End date must be after start date';
    }

    // Estimated value
    const val = parseFloat(form.estimated_value);
    if (!form.estimated_value || isNaN(val) || val <= 0) {
      errors.estimated_value = 'Estimated value must be greater than zero';
    }

    // Client name & email required
    if (!form.client_name.trim()) {
      errors.client_name = 'Client name is required';
    }
    if (!form.client_email.trim()) {
      errors.client_email = 'Client email is required';
    } else if (!isValidEmail(form.client_email)) {
      errors.client_email = 'Please enter a valid email';
    }

    // Client phone validation (if provided)
    if (form.client_phone.trim() && !isValidSLPhone(form.client_phone)) {
      errors.client_phone = 'Enter a valid Sri Lankan phone number (e.g. +94771234567)';
    }

    // Agent validations (only if agent email is provided)
    if (form.agent_email.trim()) {
      if (!isValidEmail(form.agent_email)) {
        errors.agent_email = 'Please enter a valid email';
      }
      if (!form.agent_name.trim()) {
        errors.agent_name = 'Agent name is required when agent email is provided';
      }
    }

    // Agent phone validation (if provided)
    if (form.agent_phone.trim() && !isValidSLPhone(form.agent_phone)) {
      errors.agent_phone = 'Enter a valid Sri Lankan phone number (e.g. +94771234567)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkEmail = useCallback(async (email, roleType, setStatus, setMessage) => {
    if (!email || !email.includes('@')) {
      setStatus(null);
      setMessage('');
      return;
    }

    setStatus('checking');
    setMessage('');
    try {
      const res = await projectService.checkEmail(email, roleType);
      const data = res.data;
      if (data.exists && !data.role_mismatch) {
        setStatus('found');
        setMessage(`Account found: ${data.user.full_name} (${data.user.email})`);
      } else if (data.exists && data.role_mismatch) {
        setStatus('mismatch');
        setMessage(data.message);
      } else {
        setStatus('not_found');
        setMessage('No account found — will be created on submit');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to check email');
    }
  }, []);

  const handleClientEmailBlur = () => {
    checkEmail(form.client_email, 'client', setClientEmailStatus, setClientEmailMessage);
  };

  const handleAgentEmailBlur = () => {
    if (form.agent_email) {
      checkEmail(form.agent_email, 'agent', setAgentEmailStatus, setAgentEmailMessage);
    }
  };

  const getEmailAdornment = (status) => {
    if (!status) return null;
    if (status === 'checking') return <CircularProgress size={20} />;
    if (status === 'found') return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    if (status === 'not_found') return <InfoIcon sx={{ color: 'info.main' }} />;
    if (status === 'mismatch') return <ErrorIcon sx={{ color: 'warning.main' }} />;
    if (status === 'error') return <ErrorIcon sx={{ color: 'error.main' }} />;
    return null;
  };

  const getEmailHelperColor = (status) => {
    if (status === 'found') return '#1565C0';
    if (status === 'not_found') return '#1565C0';
    if (status === 'mismatch') return '#1E88E5';
    if (status === 'error') return '#DC2626';
    return undefined;
  };

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

  const handleDocNameChange = (docId, newName) => {
    setStagedDocuments(prev =>
      prev.map(d => d.id === docId ? { ...d, name: newName } : d)
    );
  };

  const handleRemoveStagedDoc = (docId) => {
    setStagedDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    // Package data: flat project fields + client_info/agent_info as JSON objects
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      estimated_value: parseFloat(form.estimated_value) || 50000,
    };

    // Include submission_id if creating from an assigned submission
    if (submissionId) {
      payload.submission_id = submissionId;
    }

    // Build client_info if email is provided
    if (form.client_email) {
      payload.client_info = {
        name: form.client_name,
        email: form.client_email,
        phone: form.client_phone,
        address: form.client_address,
        company: form.client_company,
      };
    }

    // Build agent_info if email is provided
    if (form.agent_email) {
      payload.agent_info = {
        name: form.agent_name,
        email: form.agent_email,
        phone: form.agent_phone,
        address: form.agent_address,
        license_number: form.agent_license_number,
      };
    }

    try {
      const res = await projectService.createProject(payload);
      const newProjectId = res.data.id;

      // Upload staged documents sequentially
      if (stagedDocuments.length > 0) {
        setUploadingDocs(true);
        for (let i = 0; i < stagedDocuments.length; i++) {
          const doc = stagedDocuments[i];
          setUploadProgress(`Uploading document ${i + 1} of ${stagedDocuments.length}: ${doc.name}`);
          try {
            await projectService.uploadDocument({
              project: newProjectId,
              file: doc.file,
              name: doc.name,
            });
          } catch (uploadErr) {
            console.error(`Failed to upload document: ${doc.name}`, uploadErr);
          }
        }
        setUploadingDocs(false);
        setUploadProgress('');
      }

      navigate('/dashboard/projects');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        // Handle different error formats
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
      } else if (err.response?.status === 400) {
        setError('Invalid data provided. Please check all fields.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to create projects.');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.message || 'Failed to create project');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Create New Project</Typography>
      {submissionData && (
        <Alert icon={<AssignmentIcon />} severity="info" sx={{ mb: 2 }}>
          Creating project from client submission by{' '}
          <strong>
            {[submissionData.first_name, submissionData.last_name].filter(Boolean).join(' ') || submissionData.email}
          </strong>.
        </Alert>
      )}
      {!submissionId && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admin Approval Required</Typography>
          <Typography variant="body2">
            Projects created directly require admin approval before they can be started.
          </Typography>
        </Alert>
      )}
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
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Start Date"
                  name="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: today }}
                  required
                  error={!!formErrors.start_date}
                  helperText={formErrors.start_date}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="End Date"
                  name="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={handleChange}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: form.start_date || today }}
                  required
                  error={!!formErrors.end_date}
                  helperText={formErrors.end_date}
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
                  error={!!formErrors.estimated_value}
                  helperText={formErrors.estimated_value || 'Client must pay this amount before project starts'}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  }}
                  inputProps={{ min: 1 }}
                /></Grid>
            </Grid>
          </CardContent>
        </Card>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Client Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Client Name"
                  name="client_name"
                  value={form.client_name}
                  onChange={handleChange}
                  required
                  error={!!formErrors.client_name}
                  helperText={formErrors.client_name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Client Email"
                  name="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => {
                    handleChange(e);
                    if (clientEmailStatus) { setClientEmailStatus(null); setClientEmailMessage(''); }
                  }}
                  onBlur={handleClientEmailBlur}
                  required
                  error={!!formErrors.client_email}
                  helperText={formErrors.client_email || clientEmailMessage}
                  FormHelperTextProps={{ sx: { color: formErrors.client_email ? 'error.main' : getEmailHelperColor(clientEmailStatus) } }}
                  InputProps={{
                    endAdornment: clientEmailStatus ? (
                      <InputAdornment position="end">{getEmailAdornment(clientEmailStatus)}</InputAdornment>
                    ) : null,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Client Phone"
                  name="client_phone"
                  value={form.client_phone}
                  onChange={handleChange}
                  placeholder="+94XXXXXXXXX"
                  error={!!formErrors.client_phone}
                  helperText={formErrors.client_phone}
                />
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Company" name="client_company" value={form.client_company} onChange={handleChange} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Client Address" name="client_address" value={form.client_address} onChange={handleChange} /></Grid>
            </Grid>
            {clientEmailStatus === 'not_found' && form.client_email && (
              <Alert severity="info" sx={{ mt: 2 }}>
                A new client account will be created when you submit this project. Login credentials will be emailed to {form.client_email}.
              </Alert>
            )}
            {clientEmailStatus === 'mismatch' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {clientEmailMessage}. This email cannot be used for a client role.
              </Alert>
            )}
          </CardContent>
        </Card>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Agent Information (Optional)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Agent Name"
                  name="agent_name"
                  value={form.agent_name}
                  onChange={handleChange}
                  error={!!formErrors.agent_name}
                  helperText={formErrors.agent_name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Agent Email"
                  name="agent_email"
                  type="email"
                  value={form.agent_email}
                  onChange={(e) => {
                    handleChange(e);
                    if (agentEmailStatus) { setAgentEmailStatus(null); setAgentEmailMessage(''); }
                  }}
                  onBlur={handleAgentEmailBlur}
                  error={!!formErrors.agent_email}
                  helperText={formErrors.agent_email || agentEmailMessage}
                  FormHelperTextProps={{ sx: { color: formErrors.agent_email ? 'error.main' : getEmailHelperColor(agentEmailStatus) } }}
                  InputProps={{
                    endAdornment: agentEmailStatus ? (
                      <InputAdornment position="end">{getEmailAdornment(agentEmailStatus)}</InputAdornment>
                    ) : null,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Agent Phone"
                  name="agent_phone"
                  value={form.agent_phone}
                  onChange={handleChange}
                  placeholder="+94XXXXXXXXX"
                  error={!!formErrors.agent_phone}
                  helperText={formErrors.agent_phone}
                />
              </Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth label="License Number" name="agent_license_number" value={form.agent_license_number} onChange={handleChange} /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth label="Agent Address" name="agent_address" value={form.agent_address} onChange={handleChange} /></Grid>
            </Grid>
            {agentEmailStatus === 'not_found' && form.agent_email && (
              <Alert severity="info" sx={{ mt: 2 }}>
                A new agent account will be created when you submit this project. Login credentials will be emailed to {form.agent_email}.
              </Alert>
            )}
            {agentEmailStatus === 'mismatch' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {agentEmailMessage}. This email cannot be used for an agent role.
              </Alert>
            )}
          </CardContent>
        </Card>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Project Documents (Optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Attach documents to this project. Files will be uploaded after the project is created.
            </Typography>

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              sx={{ mb: stagedDocuments.length > 0 ? 2 : 0 }}
            >
              Add Files
              <input type="file" hidden multiple onChange={handleAddDocument} />
            </Button>

            {stagedDocuments.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stagedDocuments.map((doc) => (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                      <DescriptionIcon color="primary" fontSize="small" />
                      <TextField
                        variant="standard"
                        value={doc.name}
                        onChange={(e) => handleDocNameChange(doc.id, e.target.value)}
                        placeholder="Document name"
                        size="small"
                        sx={{ maxWidth: 300 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        ({(doc.file.size / 1024).toFixed(1)} KB)
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => handleRemoveStagedDoc(doc.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {uploadingDocs && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{uploadProgress}</Typography>
                <LinearProgress />
              </Box>
            )}
          </CardContent>
        </Card>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/dashboard/projects')}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || uploadingDocs}>
            {uploadingDocs ? 'Uploading Documents...' : loading ? 'Creating...' : 'Create Project'}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
