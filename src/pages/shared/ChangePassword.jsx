import { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Alert } from '@mui/material';
import axiosClient from '../../api/axiosClient';

export default function ChangePassword() {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axiosClient.post('/auth/change-password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setSuccess('Password changed successfully!');
      setForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Change Password</Typography>
      <Card sx={{ maxWidth: 500 }}>
        <CardContent sx={{ p: 4 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Current Password" type="password" value={form.old_password}
              onChange={(e) => setForm({ ...form, old_password: e.target.value })} margin="normal" required />
            <TextField fullWidth label="New Password" type="password" value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })} margin="normal" required helperText="Minimum 8 characters" />
            <TextField fullWidth label="Confirm New Password" type="password" value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} margin="normal" required />
            <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ mt: 2 }}>
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
