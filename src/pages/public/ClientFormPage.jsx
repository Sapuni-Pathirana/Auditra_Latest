import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, Grid, Container, Paper, Divider,
} from '@mui/material';
import {
  Send, ArrowBack, ArrowForward, PersonOutline, Handshake,
} from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';

/* ------------------------------------------------------------------ */
/*  Section heading with blue underline                                */
/* ------------------------------------------------------------------ */
const SectionHeading = ({ children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography
      variant="subtitle1"
      sx={{
        fontWeight: 700,
        color: '#1565C0',
        pb: 1,
        position: 'relative',
        display: 'inline-block',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 40,
          height: 3,
          bgcolor: '#1565C0',
          borderRadius: 1,
        },
      }}
    >
      {children}
    </Typography>
  </Box>
);

/* ------------------------------------------------------------------ */
/*  Registration type selection card                                    */
/* ------------------------------------------------------------------ */
const TypeCard = ({ icon: Icon, title, description, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: { xs: 2, sm: 2.5 },
      borderRadius: '8px',
      border: '1px solid #E2E8F0',
      borderLeft: '3px solid #1565C0',
      bgcolor: '#fff',
      cursor: 'pointer',
      transition: 'all 0.2s',
      '&:hover': {
        bgcolor: '#F8FAFC',
        borderColor: '#1565C0',
        borderLeftColor: '#1565C0',
        boxShadow: '0 2px 12px rgba(21,101,192,0.08)',
        '& .type-arrow': { opacity: 1, transform: 'translateX(0)' },
      },
    }}
  >
    <Icon sx={{ fontSize: 22, color: '#1565C0', flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="body1"
        sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9rem', lineHeight: 1.3 }}
      >
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.78rem', mt: 0.2 }}>
        {description}
      </Typography>
    </Box>
    <ArrowForward
      className="type-arrow"
      sx={{
        fontSize: 18,
        color: '#1565C0',
        opacity: 0,
        transform: 'translateX(-6px)',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    />
  </Box>
);

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
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
                  <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" name="first_name" value={form.first_name} onChange={handleChange} sx={inputSx} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" name="last_name" value={form.last_name} onChange={handleChange} sx={inputSx} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="Address" name="address" value={form.address} onChange={handleChange} sx={inputSx} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" name="phone" value={form.phone} onChange={handleChange} sx={inputSx} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="NIC" name="nic" value={form.nic} onChange={handleChange} sx={inputSx} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="Email" name="email" type="email" value={form.email} onChange={handleChange} required sx={inputSx} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="Company Name" name="company_name" value={form.company_name} onChange={handleChange} sx={inputSx} /></Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Section 2: Project Information */}
              <Box sx={{ p: { xs: 3, sm: 5 } }}>
                <SectionHeading>Project Information</SectionHeading>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}><TextField fullWidth label="Project Title" name="project_title" value={form.project_title} onChange={handleChange} required sx={inputSx} /></Grid>
                  <Grid item xs={12}><TextField fullWidth label="Project Description" name="project_description" value={form.project_description} onChange={handleChange} required multiline rows={4} sx={inputSx} /></Grid>
                </Grid>
              </Box>

              {/* Section 3: Agent Information — only for 'agent' type */}
              {regType === 'agent' && (
                <>
                  <Divider />
                  <Box sx={{ p: { xs: 3, sm: 5 } }}>
                    <SectionHeading>Agent Information</SectionHeading>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12}><TextField fullWidth label="Agent Name" name="agent_name" value={form.agent_name} onChange={handleChange} required sx={inputSx} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth label="Agent Phone" name="agent_phone" value={form.agent_phone} onChange={handleChange} required sx={inputSx} /></Grid>
                      <Grid item xs={12} sm={6}><TextField fullWidth label="Agent Email" name="agent_email" type="email" value={form.agent_email} onChange={handleChange} required sx={inputSx} /></Grid>
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
