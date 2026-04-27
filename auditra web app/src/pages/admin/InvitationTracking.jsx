import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Select, MenuItem, FormControl, InputLabel,
  CircularProgress,
} from '@mui/material';
import axiosClient from '../../api/axiosClient';

const STATUS_COLORS = {
  sent: 'default',
  delivered: 'info',
  bounced: 'error',
  accepted: 'warning',
  password_changed: 'success',
};

export default function InvitationTracking() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;
    axiosClient.get('/auth/invitations/', { params })
      .then((res) => {
        const payload = res?.data;
        const list =
          (Array.isArray(payload) && payload) ||
          (Array.isArray(payload?.data) && payload.data) ||
          (Array.isArray(payload?.results) && payload.results) ||
          [];
        setInvitations(list);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Failed to load invitations';
        setError(msg);
        setInvitations([]);
      })
      .finally(() => setLoading(false));
  }, [roleFilter, statusFilter]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Invitation Tracking</Typography>
      {error && (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Role</InputLabel>
          <Select label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="">All Roles</MenuItem>
            {['client', 'agent', 'field_officer', 'coordinator', 'accessor', 'senior_valuer'].map((r) => (
              <MenuItem key={r} value={r}>{r.replace('_', ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="">All Statuses</MenuItem>
            {['sent', 'delivered', 'bounced', 'accepted', 'password_changed'].map((s) => (
              <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sent At</TableCell>
                <TableCell>Invited By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No invitations found
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{inv.role?.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Chip
                        label={inv.status?.replace('_', ' ')}
                        size="small"
                        color={STATUS_COLORS[inv.status] || 'default'}
                        sx={{ fontSize: '0.72rem', textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>{inv.sent_at ? new Date(inv.sent_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{inv.invited_by || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
