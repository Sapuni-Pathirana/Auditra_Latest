import { useState, useRef, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, Grid, Container, Paper, Stack, Divider, Chip,
} from '@mui/material';
import { Upload, Send, ArrowBack } from '@mui/icons-material';
import authService from '../../services/authService';
import { validationRules, validateField, validateForm } from '../../utils/formValidation';
import SectionHeading from "../../components/SectionHeading";
import TypeCard from '../../components/TypeCard';


export default function EmployeeFormPage() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', address: '', phone: '', birthday: '', nic: '', email: '',
  });
  const [cvFile, setCvFile] = useState(null);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({}); // Field-level validation errors
  const emailDebounceRef = useRef(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const [emailExists, setEmailExists] = useState(null); // null, true, or false

  const checkEmailOnBlur = useCallback((value) => {
    // First validate email format
    const emailValidation = validationRules.email.validate(value);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error);
      setEmailExists(null);
      return;
    }

    // Then check for duplicates via server
    clearTimeout(emailDebounceRef.current);
    emailDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axiosClient.get('/auth/public/check-email/', { params: { email: value, intent: 'general_employee' } });
        if (res.data.conflict) {
          setEmailError('This email is already registered with a different role.');
          setEmailExists(true);
        } else if (res.data.exists) {
          setEmailError('This email is already registered.');
          setEmailExists(true);
        } else {
          setEmailError('');
          setEmailExists(false);
        }
      } catch {
        setEmailExists(null);
      }
    }, 400);
  }, []);

  const validateFieldInput = (fieldName, value) => {
    let result;
    switch (fieldName) {
      case 'first_name':
        result = validationRules.name.validate(value, 'First Name');
        break;
      case 'last_name':
        result = validationRules.name.validate(value, 'Last Name');
        break;
      case 'email':
        result = validationRules.email.validate(value);
        break;
      case 'phone':
        result = validationRules.phone.validate(value);
        break;
      case 'nic':
        result = validationRules.nic.validate(value);
        break;
      case 'address':
        result = validationRules.address.validate(value);
        break;
      case 'birthday':
        result = validationRules.birthday.validate(value);
        break;
      default:
        return;
    }

    if (result.valid) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[fieldName]; return n; });
    } else {
      setFieldErrors((prev) => ({ ...prev, [fieldName]: result.error }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (fieldErrors[name]) {
      validateFieldInput(name, value);
    }
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    validateFieldInput(name, value);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      const fileValidation = validationRules.cv_file.validate(file);
      if (!fileValidation.valid) {
        setError(fileValidation.error);
        setCvFile(null);
        return;
      }
      setCvFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setSuccess('');
    setLoading(true);

    // Validate all fields before submission
    const validation = validateForm(form, {
      first_name: { validate: (v) => validationRules.name.validate(v, 'First Name') },
      last_name: { validate: (v) => validationRules.name.validate(v, 'Last Name') },
      email: { validate: validationRules.email.validate },
      birthday: { validate: validationRules.birthday.validate },
      phone: { validate: validationRules.phone.validate },
      address: { validate: validationRules.address.validate },
      nic: { validate: validationRules.nic.validate },
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setError('Please fix the errors in the form before submitting.');
      setLoading(false);
      return;
    }

    try {
      const data = { ...form };
      if (cvFile) data.cv = cvFile;
      await authService.registerEmployee(data);
      setSuccess('Application submitted successfully! We will review and contact you.');
      setForm({ first_name: '', last_name: '', address: '', phone: '', birthday: '', nic: '', email: '' });
      setCvFile(null);
      setFieldErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data?.field === 'email') {
        setEmailError(data.error || 'An account with this email already exists.');
      } else if (data && typeof data === 'object') {
        const msg = data.error || Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        setError(msg);
      } else {
        setError('Submission failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', '&:hover fieldset': { borderColor: '#1565C0' } } };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9' }}>
      {/* White top spacer */}
      <Box sx={{ bgcolor: '#fff', height: { xs: 44, md: 44 } }} />

      {/* Blue Hero Banner */}
      <Box
        sx={{
          bgcolor: '#1565C0',
          position: 'relative',
          pt: { xs: 5, md: 6 },
          pb: { xs: 8, md: 10 },
        }}
      >
        <Container maxWidth="lg">
          <Button
            component={Link}
            to="/"
            startIcon={<ArrowBack />}
            sx={{
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.85rem',
              mb: 2,
              px: 0,
              '&:hover': { color: '#fff', bgcolor: 'transparent' },
            }}
          >
            Back to Home
          </Button>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: '#fff',
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              mb: 1.5,
            }}
          >
            Employee Registration
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: { xs: '0.9rem', md: '1rem' },
              maxWidth: 500,
              lineHeight: 1.7,
            }}
          >
            Submit your application to join the Auditra team. We review
            all applications and will get back to you shortly.
          </Typography>
        </Container>

        {/* Diagonal bottom edge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            width: '100%',
            lineHeight: 0,
          }}
        >
          <svg
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: '40px' }}
          >
            <polygon points="0,60 1440,0 1440,60" fill="#F1F5F9" />
          </svg>
        </Box>
      </Box>

      {/* Form Section */}
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, mt: { xs: -2, md: -3 } }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          {error && <Alert severity="error" sx={{ borderRadius: 0, whiteSpace: 'pre-line' }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ borderRadius: 0 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            {/* Section 1: Personal Information */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <SectionHeading>Personal Information</SectionHeading>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="First Name" name="first_name" value={form.first_name}
                    onChange={handleChange} onBlur={handleFieldBlur} required sx={inputSx}
                    error={!!fieldErrors.first_name} helperText={fieldErrors.first_name || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Last Name" name="last_name" value={form.last_name}
                    onChange={handleChange} onBlur={handleFieldBlur} required sx={inputSx}
                    error={!!fieldErrors.last_name} helperText={fieldErrors.last_name || ''}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Address" name="address" value={form.address}
                    onChange={handleChange} onBlur={handleFieldBlur} sx={inputSx}
                    error={!!fieldErrors.address} helperText={fieldErrors.address || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Phone" name="phone" value={form.phone}
                    onChange={handleChange} onBlur={handleFieldBlur} sx={inputSx}
                    error={!!fieldErrors.phone} helperText={fieldErrors.phone || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Birthday" name="birthday" type="date" value={form.birthday}
                    onChange={handleChange} onBlur={handleFieldBlur} required
                    InputLabelProps={{ shrink: true }} sx={inputSx}
                    error={!!fieldErrors.birthday} helperText={fieldErrors.birthday || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="NIC" name="nic" value={form.nic}
                    onChange={handleChange} onBlur={handleFieldBlur} sx={inputSx}
                    error={!!fieldErrors.nic} helperText={fieldErrors.nic || ''}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box>
                    <TextField
                      fullWidth label="Email" name="email" type="email" value={form.email}
                      onChange={handleChange} onBlur={(e) => { handleFieldBlur(e); checkEmailOnBlur(e.target.value); }}
                      error={!!emailError || !!fieldErrors.email} helperText={emailError || fieldErrors.email || ''} sx={inputSx}
                      required
                    />
                    {emailExists === true && (
                      <Chip
                        label="Email already registered"
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: '#FEF3C7',
                          color: '#92400E',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      />
                    )}
                    {emailExists === false && form.email && (
                      <Chip
                        label="Email available"
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: '#DBEAFE',
                          color: '#1E40AF',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Section 2: Documents */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <SectionHeading>Documents</SectionHeading>

              <input type="file" ref={fileRef} accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
              <Button
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => fileRef.current.click()}
                fullWidth
                sx={{
                  py: 2,
                  justifyContent: 'flex-start',
                  borderRadius: '8px',
                  borderColor: '#E2E8F0',
                  color: cvFile ? '#1565C0' : '#64748B',
                  borderStyle: 'dashed',
                  bgcolor: '#FAFAFA',
                  '&:hover': { borderColor: '#1565C0', bgcolor: '#EFF6FF' },
                }}
              >
                {cvFile ? cvFile.name : 'Upload CV (PDF, DOC, DOCX)'}
              </Button>

              <Button
                type="submit" fullWidth variant="contained" size="large" disabled={loading}
                endIcon={<Send />}
                sx={{
                  mt: 4, py: 1.5, borderRadius: '8px', bgcolor: '#1565C0',
                  fontWeight: 600, textTransform: 'none', fontSize: '1rem',
                  '&:hover': { bgcolor: '#0D47A1' },
                }}
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
