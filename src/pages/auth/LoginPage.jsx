import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, InputAdornment, IconButton,
  Grid, Stack, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import axiosClient from '../../api/axiosClient';
import logo from '../../assets/logo.webp';
import hero1 from '../../assets/hero1.webp';
import hero2 from '../../assets/hero2.webp';
import hero3 from '../../assets/hero3.webp';

const heroImages = [hero1, hero2, hero3];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#F8FAFC',
    '& fieldset': { borderColor: '#E2E8F0' },
    '&:hover fieldset': { borderColor: '#1565C0' },
    '&.Mui-focused fieldset': { borderColor: '#1565C0' },
  },
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Hero slideshow
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Forgot password flow state
  // Steps: null (login), 'email', 'otp', 'newpass'
  const [fpStep, setFpStep] = useState(null);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpMessage, setFpMessage] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.passwordChanged === false) {
        navigate('/dashboard/force-change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setFpStep(null);
    setFpEmail('');
    setFpOtp('');
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpMessage('');
    setFpError('');
    setFpShowPassword(false);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpMessage('');
    setFpLoading(true);
    try {
      await axiosClient.post('/auth/password-reset/request/', { email: fpEmail });
      setFpMessage('OTP sent to your email');
      setFpStep('otp');
    } catch (err) {
      setFpError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setFpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpMessage('');
    setFpLoading(true);
    try {
      await axiosClient.post('/auth/password-reset/verify-otp/', { email: fpEmail, otp: fpOtp });
      setFpMessage('OTP verified. Set your new password.');
      setFpStep('newpass');
    } catch (err) {
      setFpError(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpMessage('');
    if (fpNewPassword.length < 8) {
      setFpError('Password must be at least 8 characters');
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError('Passwords do not match');
      return;
    }
    setFpLoading(true);
    try {
      await axiosClient.post('/auth/password-reset/confirm/', { email: fpEmail, new_password: fpNewPassword });
      setFpMessage('Password reset successfully! You can now sign in.');
      setTimeout(() => resetForgotPassword(), 2000);
    } catch (err) {
      setFpError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setFpLoading(false);
    }
  };

  /* ================================================================ */
  /*  Render — Right panel content                                     */
  /* ================================================================ */

  const renderRightPanel = () => {
    // ── Forgot Password: Enter Email ──
    if (fpStep === 'email') {
      return (
        <Box sx={{ width: '100%', maxWidth: 380, border: '1px solid #E2E8F0', borderRadius: '8px', p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
            Forgot Password
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3, fontSize: '0.9rem' }}>
            Enter your email to receive an OTP code
          </Typography>

          {fpError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{fpError}</Alert>}
          {fpMessage && <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>{fpMessage}</Alert>}

          <form onSubmit={handleRequestOtp}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                  Email Address
                </Typography>
                <TextField
                  fullWidth placeholder="Enter your email" type="email" value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)} required variant="outlined" size="medium" sx={inputSx}
                />
              </Box>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={fpLoading}
                sx={{ bgcolor: '#1565C0', py: 1.4, borderRadius: '8px', fontWeight: 600, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: '#0D47A1' } }}
              >
                {fpLoading ? <CircularProgress size={22} color="inherit" /> : 'Send OTP'}
              </Button>
            </Stack>
          </form>

          <Button fullWidth onClick={resetForgotPassword} sx={{ mt: 2, textTransform: 'none', color: '#64748B', fontSize: '0.85rem' }}>
            Back to Sign In
          </Button>
        </Box>
      );
    }

    // ── Forgot Password: Enter OTP ──
    if (fpStep === 'otp') {
      return (
        <Box sx={{ width: '100%', maxWidth: 380, border: '1px solid #E2E8F0', borderRadius: '8px', p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
            Enter OTP
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3, fontSize: '0.9rem' }}>
            Check your email for the 6-digit code
          </Typography>

          {fpError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{fpError}</Alert>}
          {fpMessage && <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>{fpMessage}</Alert>}

          <form onSubmit={handleVerifyOtp}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                  OTP Code
                </Typography>
                <TextField
                  fullWidth placeholder="Enter 6-digit OTP" value={fpOtp}
                  onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required variant="outlined" size="medium"
                  inputProps={{ maxLength: 6, style: { letterSpacing: 8, textAlign: 'center', fontWeight: 700, fontSize: '1.2rem' } }}
                  sx={inputSx}
                />
              </Box>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={fpLoading || fpOtp.length !== 6}
                sx={{ bgcolor: '#1565C0', py: 1.4, borderRadius: '8px', fontWeight: 600, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: '#0D47A1' } }}
              >
                {fpLoading ? <CircularProgress size={22} color="inherit" /> : 'Verify OTP'}
              </Button>
            </Stack>
          </form>

          <Button fullWidth onClick={() => { setFpStep('email'); setFpError(''); setFpMessage(''); }}
            sx={{ mt: 2, textTransform: 'none', color: '#64748B', fontSize: '0.85rem' }}
          >
            Resend OTP
          </Button>
        </Box>
      );
    }

    // ── Forgot Password: Set New Password ──
    if (fpStep === 'newpass') {
      return (
        <Box sx={{ width: '100%', maxWidth: 380, border: '1px solid #E2E8F0', borderRadius: '8px', p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
            New Password
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 3, fontSize: '0.9rem' }}>
            Set a new password for your account
          </Typography>

          {fpError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>{fpError}</Alert>}
          {fpMessage && <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>{fpMessage}</Alert>}

          <form onSubmit={handleResetPassword}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                  New Password
                </Typography>
                <TextField
                  fullWidth placeholder="Enter new password" type={fpShowPassword ? 'text' : 'password'}
                  value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)}
                  required variant="outlined" size="medium"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setFpShowPassword(!fpShowPassword)} edge="end" size="small">
                          {fpShowPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={inputSx}
                />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                  Confirm Password
                </Typography>
                <TextField
                  fullWidth placeholder="Confirm new password" type={fpShowPassword ? 'text' : 'password'}
                  value={fpConfirmPassword} onChange={(e) => setFpConfirmPassword(e.target.value)}
                  required variant="outlined" size="medium" sx={inputSx}
                />
              </Box>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={fpLoading}
                sx={{ bgcolor: '#1565C0', py: 1.4, borderRadius: '8px', fontWeight: 600, textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none', '&:hover': { bgcolor: '#0D47A1' } }}
              >
                {fpLoading ? <CircularProgress size={22} color="inherit" /> : 'Reset Password'}
              </Button>
            </Stack>
          </form>
        </Box>
      );
    }

    // ── Default: Login Form ──
    return (
      <Box sx={{ width: '100%', maxWidth: 380, border: '1px solid #E2E8F0', borderRadius: '8px', p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
          Welcome back
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', mb: 4, fontSize: '0.9rem' }}>
          Sign in to your Auditra dashboard
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                Username
              </Typography>
              <TextField
                fullWidth placeholder="Enter your username" value={username}
                onChange={(e) => setUsername(e.target.value)} required autoFocus
                variant="outlined" size="medium" sx={inputSx}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.8, fontSize: '0.85rem' }}>
                Password
              </Typography>
              <TextField
                fullWidth placeholder="Enter your password" type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)} required
                variant="outlined" size="medium"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
            </Box>

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
              startIcon={<LoginIcon />}
              sx={{
                bgcolor: '#1565C0', py: 1.4, borderRadius: '8px', fontWeight: 600,
                textTransform: 'none', fontSize: '0.95rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#0D47A1', boxShadow: '0 4px 12px rgba(21,101,192,0.3)' },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Stack>
        </form>

        {/* Forgot Password */}
        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
          <Button
            onClick={() => setFpStep('email')}
            sx={{ textTransform: 'none', color: '#1565C0', fontWeight: 500, fontSize: '0.85rem', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
          >
            Forgot your password?
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      <Grid container sx={{ minHeight: '100vh' }}>

        {/* ── Left — Photo Panel ── */}
        <Grid
          item xs={12} md={8}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            minHeight: { xs: 300, md: 'auto' },
          }}
        >
          {heroImages.map((img, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: i === heroIndex ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out',
              }}
            />
          ))}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(13,71,161,0.35) 0%, rgba(21,101,192,0.45) 50%, rgba(13,71,161,0.55) 100%)',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 2, p: { xs: 3, md: 5 }, mt: 'auto' }}>
            <Box
              component="img"
              src={logo}
              alt="Auditra"
              sx={{
                height: { xs: 60, md: 80 },
                mb: 3,
                mixBlendMode: 'screen',
                filter: 'brightness(1.2) drop-shadow(0 0 12px rgba(255,255,255,0.5)) drop-shadow(0 0 30px rgba(255,255,255,0.25))',
              }}
            />

            <Typography
              variant="h1"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '2rem', sm: '2.8rem', md: '3.5rem' },
                lineHeight: 1.2,
                mb: 2,
              }}
            >
              Your Trusted Partner<br />in Auditing
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: { xs: '0.95rem', md: '1.1rem' },
                lineHeight: 1.7,
                maxWidth: 520,
                mb: 4,
              }}
            >
              Precision auditing, compliance advisory, and financial
              services across Sri Lanka.
            </Typography>

            <Stack direction="row" spacing={4} sx={{ mb: { xs: 2, md: 3 } }}>
              {[
                { value: '15+', label: 'Years' },
                { value: '500+', label: 'Projects' },
                { value: '200+', label: 'Clients' },
              ].map((stat) => (
                <Box key={stat.label}>
                  <Typography
                    variant="h6"
                    sx={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem', lineHeight: 1 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>

        {/* ── Right — Form Panel ── */}
        <Grid
          item xs={12} md={4}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: '#fff',
            p: { xs: 3, md: 4 },
            position: 'relative',
          }}
        >
          {renderRightPanel()}

          {/* Copyright — centered bottom */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: '#94A3B8',
              fontSize: '0.7rem',
            }}
          >
            &copy; 2025 Auditra (Pvt) Ltd. All rights reserved.
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}
