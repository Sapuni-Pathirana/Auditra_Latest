import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button,
  IconButton, CircularProgress, Alert, Chip,
} from '@mui/material';
import { CameraAlt, Save, Lock, DesktopWindows, LightMode, DarkMode, CheckCircle } from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import UserAvatar from '../../components/UserAvatar';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { preference, setThemePreference, applyServerTheme } = useThemeMode();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    timezone: 'Asia/Colombo',
  });

  useEffect(() => {
    axiosClient.get('/auth/profile/me/').then((res) => {
      const data = res.data;
      setProfile(data);
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.profile?.phone || '',
        bio: data.profile?.bio || '',
        timezone: data.profile?.timezone || 'Asia/Colombo',
      });
      if (data.profile?.theme_preference) {
        applyServerTheme(data.profile.theme_preference);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await axiosClient.patch('/auth/profile/me/', {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        bio: form.bio,
        timezone: form.timezone,
        theme_preference: preference,
      });
      setSuccess('Profile updated successfully');
      if (updateUser) updateUser({ ...user, first_name: form.first_name, last_name: form.last_name });
    } catch (e) {
      setError('Failed to save profile');
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await axiosClient.post('/auth/profile/me/avatar/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile((prev) => ({
        ...prev,
        profile: { ...prev?.profile, profile_image_url: res.data.profile_image_url },
      }));
      if (updateUser) updateUser({ ...user, profile_image_url: res.data.profile_image_url });
      setSuccess('Avatar updated');
    } catch {
      setError('Avatar upload failed (max 2MB JPEG/PNG)');
    }
    setUploading(false);
  };

  const themeCards = [
    {
      key: 'system',
      title: 'Default',
      subtitle: 'Follow device theme',
      icon: <DesktopWindows fontSize="small" />,
      previewDark: false,
    },
    {
      key: 'light',
      title: 'Light',
      subtitle: 'Bright daytime layout',
      icon: <LightMode fontSize="small" />,
      previewDark: false,
    },
    {
      key: 'dark',
      title: 'Dark',
      subtitle: 'Low-light travel mode',
      icon: <DarkMode fontSize="small" />,
      previewDark: true,
    },
  ];

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 3, px: 2 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>My Profile</Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Avatar card */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box sx={{ position: 'relative' }}>
          <UserAvatar
            user={{ ...user, profile_image_url: profile?.profile?.profile_image_url }}
            size={80}
          />
          <IconButton
            size="small"
            sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <CircularProgress size={16} /> : <CameraAlt fontSize="small" />}
          </IconButton>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarUpload} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {form.first_name} {form.last_name || user?.username}
          </Typography>
          <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
          {profile?.role_info?.role_display && (
            <Chip label={profile.role_info.role_display} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
          )}
        </Box>
      </Paper>

      {/* Personal info */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Personal Information</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="First Name" value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            fullWidth size="small"
          />
          <TextField
            label="Last Name" value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            fullWidth size="small"
          />
        </Box>
        <TextField
          label="Email (read-only)" value={user?.email || ''} fullWidth size="small"
          sx={{ mt: 2 }} disabled
        />
        <TextField
          label="Phone" value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          fullWidth size="small" sx={{ mt: 2 }}
        />
        <TextField
          label="Bio" value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          fullWidth multiline rows={3} size="small" sx={{ mt: 2 }}
        />
        <TextField
          label="Timezone" value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          fullWidth size="small" sx={{ mt: 2 }}
        />
      </Paper>

      {/* Preferences */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={700}>Appearance</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
          Choose your preferred theme. This applies across the entire app.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {themeCards.map((card) => {
            const selected = preference === card.key;
            return (
              <Paper
                key={card.key}
                onClick={() => setThemePreference(card.key)}
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: selected ? 'primary.main' : 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                {selected && (
                  <CheckCircle
                    color="primary"
                    sx={{ position: 'absolute', top: 10, right: 10, fontSize: 20 }}
                  />
                )}

                <Box
                  sx={{
                    height: 96,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: card.previewDark ? '#1f2937' : '#d1d5db',
                    bgcolor: card.previewDark ? '#0b1220' : '#f8fafc',
                    overflow: 'hidden',
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ height: 10, bgcolor: card.previewDark ? '#14b8a6' : '#0ea5a4' }} />
                  <Box sx={{ p: 1.25 }}>
                    <Box sx={{ width: '72%', height: 7, borderRadius: 1, bgcolor: card.previewDark ? '#4b5563' : '#9ca3af', mb: 1 }} />
                    <Box sx={{ width: '48%', height: 7, borderRadius: 1, bgcolor: card.previewDark ? '#374151' : '#cbd5e1', mb: 1.25 }} />
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Box sx={{ width: 28, height: 13, borderRadius: 1, bgcolor: card.previewDark ? '#111827' : '#ffffff', border: '1px solid', borderColor: card.previewDark ? '#334155' : '#e5e7eb' }} />
                      <Box sx={{ width: 28, height: 13, borderRadius: 1, bgcolor: card.previewDark ? '#111827' : '#ffffff', border: '1px solid', borderColor: card.previewDark ? '#334155' : '#e5e7eb' }} />
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.75 }}>
                  {card.icon}
                  <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 0.25 }}>
                  {card.subtitle}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      </Paper>

      {/* Security */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Security</Typography>
        <Button startIcon={<Lock />} variant="outlined" onClick={() => navigate('/dashboard/change-password')}>
          Change Password
        </Button>
      </Paper>

      {/* Save */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave} disabled={saving}
        >
          Save Changes
        </Button>
      </Box>
    </Box>
  );
}
