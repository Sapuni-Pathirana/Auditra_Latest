import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, TextField, Button, Alert } from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axiosClient.post('/auth/change-password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', pt: 4 }}>
      <Card sx={{ maxWidth: 480, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LockResetIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Change Your Password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              For security, please change your auto-generated password before continuing.
            </Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Current Password (from email)"
              type="password"
              value={form.old_password}
              onChange={(e) => setForm({ ...form, old_password: e.target.value })}
              margin="normal"
              required
              helperText="Enter the password sent to your email"
            />
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              margin="normal"
              required
              helperText="Minimum 8 characters"
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type="password"
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              margin="normal"
              required
            />
            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ mt: 2 }}>
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
