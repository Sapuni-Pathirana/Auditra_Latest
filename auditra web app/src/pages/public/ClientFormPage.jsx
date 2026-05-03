import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, Grid, Container, Paper, Divider, Chip,
} from '@mui/material';
import {
  Send, ArrowBack, ArrowForward, PersonOutline, Handshake,
} from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';
import { validationRules, validateForm } from '../../utils/formValidation';
import SectionHeading from "../../components/SectionHeading";
import TypeCard from '../../components/TypeCard';


async function checkEmail(email, intent) {
  if (!email || !email.includes('@')) return null;
  try {
    const res = await axiosClient.get('/auth/public/check-email/', { params: { email, intent } });
    return res.data;
  } catch { return null; }
}

export default function ClientFormPage() {
  const [regType, setRegType] = useState(null); // null | 'direct' | 'agent'
  const [form, setForm] = useState({
    first_name: '', last_name: '', address: '', phone: '', nic: '', email: '',
    company_name: '', project_title: '', project_description: '',
    agent_name: '', agent_phone: '', agent_email: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailErrors, setEmailErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({}); // Field-level validation errors
  const debounceRef = useRef({});
  const [emailExistsStatus, setEmailExistsStatus] = useState({}); // Track existence status for each email field

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (fieldErrors[name]) {
      validateFieldInput(name, value, regType);
    }
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    validateFieldInput(name, value, regType);
  };

  const validateFieldInput = (fieldName, value, currentRegType = regType) => {
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
      case 'company_name':
        result = validationRules.company_name.validate(value);
        break;
      case 'project_title':
        result = validationRules.project_title.validate(value);
        break;
      case 'project_description':
        result = validationRules.project_description.validate(value);
        break;
      case 'agent_name':
        result = validationRules.name.validate(value, 'Agent Name');
        break;
      case 'agent_phone':
        result = validationRules.phone.validate(value);
        break;
      case 'agent_email':
        result = validationRules.email.validate(value);
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

  const validateEmailField = useCallback((fieldName, value, intent) => {
    // First validate email format
    const emailValidation = validationRules.email.validate(value);
    if (!emailValidation.valid) {
      setEmailErrors((prev) => ({ ...prev, [fieldName]: emailValidation.error }));
      return;
    }

    // Then check for duplicates via server
    clearTimeout(debounceRef.current[fieldName]);
    debounceRef.current[fieldName] = setTimeout(async () => {
      const result = await checkEmail(value, intent);
      if (!result) return;
      if (result.conflict) {
        setEmailErrors((prev) => ({ ...prev, [fieldName]: `This email is already registered with a different role (${intent}).` }));
      } else if (result.exists && !result.conflict) {
        setEmailErrors((prev) => ({ ...prev, [fieldName]: 'This email is already registered.' }));
      } else {
        setEmailErrors((prev) => { const n = { ...prev }; delete n[fieldName]; return n; });
      }
    }, 400);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Define field rules based on registration type
    const baseRules = {
      first_name: { validate: (v) => validationRules.name.validate(v, 'First Name') },
      last_name: { validate: (v) => validationRules.name.validate(v, 'Last Name') },
      email: { validate: validationRules.email.validate },
      project_title: { validate: validationRules.project_title.validate },
      project_description: { validate: validationRules.project_description.validate },
      phone: { validate: validationRules.phone.validate },
      address: { validate: validationRules.address.validate },
      nic: { validate: validationRules.nic.validate },
      company_name: { validate: validationRules.company_name.validate },
    };

    const agentRules = {
      ...baseRules,
      agent_name: { validate: (v) => validationRules.name.validate(v, 'Agent Name') },
      agent_phone: { validate: validationRules.phone.validate },
      agent_email: { validate: validationRules.email.validate },
    };

    const rules = regType === 'agent' ? agentRules : baseRules;

    // Validate all fields
    const validation = validateForm(form, rules);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setError('Please fix the errors in the form before submitting.');
      setLoading(false);
      return;
    }

    try {
      const payload = { ...form };
      if (regType === 'direct') {
        delete payload.agent_name;
        delete payload.agent_phone;
        delete payload.agent_email;
      }
      await axiosClient.post('/clients/register/', payload);
      setSuccess('Registration submitted successfully! We will contact you soon.');
      setForm({
        first_name: '', last_name: '', address: '', phone: '', nic: '', email: '',
        company_name: '', project_title: '', project_description: '',
        agent_name: '', agent_phone: '', agent_email: '',
      });
      setRegType(null);
      setFieldErrors({});
      setEmailErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const messages = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(messages.join('\n'));
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
              color: 'rgba(255, 255, 255, 0.8)',
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
            Client Registration
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
            {regType
              ? regType === 'direct'
                ? 'Submit your details and project information. Our team will reach out within 24 hours.'
                : 'Submit your details along with your agent information. We will coordinate with your agent.'
              : 'Choose how you would like to register with us.'}
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

      {/* Content Section */}
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 }, mt: { xs: -2, md: -3 } }}>

        {/* ============================================================ */}
        {/*  Step 1: Choose Registration Type                             */}
        {/* ============================================================ */}
        {!regType && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              bgcolor: '#fff',
            }}
          >
            {success && (
              <Alert severity="success" sx={{ borderRadius: 0 }}>
                {success}
              </Alert>
            )}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <SectionHeading>Registration Type</SectionHeading>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>
                Select how you would like to register with us
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TypeCard
                  icon={PersonOutline}
                  title="Direct Registration"
                  description="Register directly without an agent"
                  onClick={() => setRegType('direct')}
                />
                <TypeCard
                  icon={Handshake}
                  title="Through an Agent"
                  description="Register through a referring agent"
                  onClick={() => setRegType('agent')}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* ============================================================ */}
        {/*  Step 2: Registration Form                                    */}
        {/* ============================================================ */}
        {regType && (
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

            {/* Type indicator + change link */}
            <Box
              sx={{
                px: { xs: 3, sm: 5 },
                pt: { xs: 2.5, sm: 3 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {regType === 'direct'
                  ? <PersonOutline sx={{ fontSize: 20, color: '#1565C0' }} />
                  : <Handshake sx={{ fontSize: 20, color: '#1565C0' }} />}
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                  {regType === 'direct' ? 'Direct Registration' : 'Registration Through Agent'}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => { setRegType(null); setError(''); setSuccess(''); }}
                sx={{
                  textTransform: 'none',
                  color: '#64748B',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  '&:hover': { color: '#1565C0', bgcolor: 'transparent' },
                }}
              >
                Change
              </Button>
            </Box>

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
                      fullWidth label="NIC" name="nic" value={form.nic}
                      onChange={handleChange} onBlur={handleFieldBlur} sx={inputSx}
                      error={!!fieldErrors.nic} helperText={fieldErrors.nic || ''}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box>
                      <TextField
                        fullWidth label="Email" name="email" type="email" value={form.email}
                        onChange={(e) => { handleChange(e); setEmailErrors((prev) => { const n = { ...prev }; delete n.email; return n; }); }}
                        onBlur={(e) => { handleFieldBlur(e); validateEmailField('email', e.target.value, 'client'); }}
                        required sx={inputSx}
                        error={!!emailErrors.email || !!fieldErrors.email}
                        helperText={emailErrors.email || fieldErrors.email || ''}
                      />
                      {emailExistsStatus.email === true && (
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
                      {emailExistsStatus.email === false && form.email && (
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
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Company Name" name="company_name" value={form.company_name}
                      onChange={handleChange} onBlur={handleFieldBlur} sx={inputSx}
                      error={!!fieldErrors.company_name} helperText={fieldErrors.company_name || ''}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Section 2: Project Information */}
              <Box sx={{ p: { xs: 3, sm: 5 } }}>
                <SectionHeading>Project Information</SectionHeading>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Project Title" name="project_title" value={form.project_title}
                      onChange={handleChange} onBlur={handleFieldBlur} required sx={inputSx}
                      error={!!fieldErrors.project_title} helperText={fieldErrors.project_title || ''}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Project Description" name="project_description" value={form.project_description}
                      onChange={handleChange} onBlur={handleFieldBlur} required multiline rows={4} sx={inputSx}
                      error={!!fieldErrors.project_description} helperText={fieldErrors.project_description || ''}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Section 3: Agent Information — only for 'agent' type */}
              {regType === 'agent' && (
                <>
                  <Divider />
                  <Box sx={{ p: { xs: 3, sm: 5 } }}>
                    <SectionHeading>Agent Information</SectionHeading>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth label="Agent Name" name="agent_name" value={form.agent_name}
                          onChange={handleChange} onBlur={handleFieldBlur} required sx={inputSx}
                          error={!!fieldErrors.agent_name} helperText={fieldErrors.agent_name || ''}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label="Agent Phone" name="agent_phone" value={form.agent_phone}
                          onChange={handleChange} onBlur={handleFieldBlur} required sx={inputSx}
                          error={!!fieldErrors.agent_phone} helperText={fieldErrors.agent_phone || ''}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <TextField
                            fullWidth label="Agent Email" name="agent_email" type="email" value={form.agent_email}
                            onChange={(e) => { handleChange(e); setEmailErrors((prev) => { const n = { ...prev }; delete n.agent_email; return n; }); }}
                            onBlur={(e) => { handleFieldBlur(e); validateEmailField('agent_email', e.target.value, 'agent'); }}
                            required sx={inputSx}
                            error={!!emailErrors.agent_email || !!fieldErrors.agent_email}
                            helperText={emailErrors.agent_email || fieldErrors.agent_email || ''}
                          />
                          {emailExistsStatus.agent_email === true && (
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
                          {emailExistsStatus.agent_email === false && form.agent_email && (
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
                </>
              )}

              {/* Submit Button */}
              <Box sx={{ px: { xs: 3, sm: 5 }, pb: { xs: 3, sm: 5 }, pt: regType === 'direct' ? 0 : undefined }}>
                <Button
                  type="submit" fullWidth variant="contained" size="large" disabled={loading}
                  endIcon={<Send />}
                  sx={{
                    py: 1.5, borderRadius: '8px', bgcolor: '#1565C0',
                    fontWeight: 600, textTransform: 'none', fontSize: '1rem',
                    '&:hover': { bgcolor: '#0D47A1' },
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </Box>
            </form>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
