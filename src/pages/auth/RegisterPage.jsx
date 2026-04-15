import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, Grid, Container, Paper, Stack,
} from '@mui/material';
import { PersonAdd, ArrowBack } from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';
import logo from '../../assets/logo.webp';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '', first_name: '', last_name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.password2) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axiosClient.post('/auth/register/', form);
      setSuccess('Registration successful! You can now login. An admin will assign your role.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const messages = Object.entries(data).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`);
        setError(messages.join('\n'));
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', display: 'flex' }}>
      <Grid container sx={{ minHeight: '100vh' }}>
        {/* Left — Brand Panel */}
        <Grid
          item xs={12} md={5}
          sx={{
            background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: { xs: 4, md: 8 },
            position: 'relative',
            overflow: 'hidden',
            minHeight: { xs: 240, md: 'auto' },
          }}
        >
          <Box sx={{ position: 'absolute', top: -80, left: -80, width: 250, height: 250, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
          <Box sx={{ position: 'absolute', bottom: -60, right: -60, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />

          <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Box
              component="img"
              src={logo}
              alt="Auditra"
              sx={{ height: { xs: 48, md: 56 }, mb: 3, filter: 'brightness(2)' }}
            />
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
              Join Auditra
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 320, mx: 'auto', lineHeight: 1.7 }}>
              Create your account to get started with our professional auditing and advisory services.
            </Typography>
          </Box>
        </Grid>

        {/* Right — Register Form */}
        <Grid
          item xs={12} md={7}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 3, md: 6 },
          }}
        >
          <Container maxWidth="sm">
            <Box sx={{ mb: 4 }}>
              <Button
                component={Link}
                to="/"
                startIcon={<ArrowBack />}
                sx={{ color: '#64748B', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#1565C0', bgcolor: 'transparent' } }}
              >
                Back to Home
              </Button>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 5 },
                borderRadius: 3,
                border: '1px solid #E2E8F0',
                bgcolor: '#fff',
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 1 }}>
                Create Account
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 4 }}>
                Fill in your details to register
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2, whiteSpace: 'pre-line' }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}

              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField fullWidth label="First Name" name="first_name" value={form.first_name} onChange={handleChange}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth label="Last Name" name="last_name" value={form.last_name} onChange={handleChange}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Username" name="username" value={form.username} onChange={handleChange} required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Email" name="email" type="email" value={form.email} onChange={handleChange} required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Password" name="password" type="password" value={form.password} onChange={handleChange} required helperText="Minimum 8 characters"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Confirm Password" name="password2" type="password" value={form.password2} onChange={handleChange} required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                </Grid>

                <Button
                  type="submit" fullWidth variant="contained" size="large" disabled={loading}
                  startIcon={<PersonAdd />}
                  sx={{
                    mt: 3, py: 1.5, borderRadius: 2, bgcolor: '#1565C0',
                    fontWeight: 600, textTransform: 'none', fontSize: '1rem',
                    '&:hover': { bgcolor: '#0D47A1' },
                  }}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>

              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  Already have an account?{' '}
                  <Link to="/login" style={{ color: '#1565C0', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
                </Typography>
              </Box>
            </Paper>
          </Container>
        </Grid>
      </Grid>
    </Box>
  );
}
