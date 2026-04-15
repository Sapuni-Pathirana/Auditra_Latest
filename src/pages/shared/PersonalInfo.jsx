import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Grid, Avatar, Button, Chip, Divider, Alert } from '@mui/material';
import { Edit, Lock, Person } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../utils/roleConfig';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function PersonalInfo() {
  const { user, role, loading, refreshUser } = useAuth();
  const navigate = useNavigate();

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Personal Information</Typography>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
            <Avatar
              sx={{
                width: 88,
                height: 88,
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(59,130,246,0.12)' : 'rgba(21,101,192,0.08)',
                border: (t) => `3px solid ${t.palette.mode === 'dark' ? 'rgba(59,130,246,0.2)' : 'rgba(21,101,192,0.15)'}`,
                boxShadow: (t) => t.palette.mode === 'dark' ? '0 4px 14px rgba(0,0,0,0.3)' : '0 4px 14px rgba(21,101,192,0.15)',
              }}
            >
              <Person sx={{ fontSize: 48, color: 'primary.main' }} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{user?.email}</Typography>
              <Chip label={getRoleLabel(role)} sx={{ bgcolor: (t) => `${t.palette.primary.main}14`, color: 'primary.main', fontWeight: 600, border: (t) => `1px solid ${t.palette.primary.main}50` }} />
            </Box>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Username</Typography>
              <Typography variant="body1" fontWeight={600}>{user?.username || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Email</Typography>
              <Typography variant="body1" fontWeight={600}>{user?.email || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">First Name</Typography>
              <Typography variant="body1" fontWeight={600}>{user?.first_name || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Last Name</Typography>
              <Typography variant="body1" fontWeight={600}>{user?.last_name || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">User ID</Typography>
              <Typography variant="body1" fontWeight={600}>{user?.id || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">Role</Typography>
              <Typography variant="body1" fontWeight={600}>{getRoleLabel(role)}</Typography>
            </Grid>
          </Grid>
          <Box sx={{ mt: 4 }}>
            <Button variant="outlined" startIcon={<Lock />} onClick={() => navigate('/dashboard/change-password')}>
              Change Password
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
