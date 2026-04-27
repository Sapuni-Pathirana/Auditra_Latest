import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import { Add, Cancel } from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import StatsCard from '../../components/StatsCard';
import TabFilters from '../../components/TabFilters';
import { formatDate } from '../../utils/helpers';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'casual', label: 'Casual' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

const defaultForm = {
  leave_type: 'annual',
  start_date: '',
  end_date: '',
  reason: '',
  is_half_day: false,
  half_day_period: 'morning',
};

export default function MyLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [balance, setBalance] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState({ open: false, id: null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [reqRes, balRes, statsRes] = await Promise.all([
        axiosClient.get('/auth/leave-requests/my/'),
        axiosClient.get('/auth/leave-balance/').catch(() => null),
        axiosClient.get('/auth/leave-requests/statistics/').catch(() => null),
      ]);
      const list = reqRes.data?.results ?? reqRes.data?.data ?? reqRes.data ?? [];
      setRequests(Array.isArray(list) ? list : []);
      if (balRes) setBalance(balRes.data);
      if (statsRes?.data?.success) setStats(statsRes.data.data);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.is_half_day) {
        // For half-day, start_date == end_date
        payload.end_date = payload.start_date;
      }
      await axiosClient.post('/auth/leave-requests/create/', payload);
      setSuccess('Leave request submitted!');
      setDialogOpen(false);
      setForm(defaultForm);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const id = cancelDialog.id;
    setCancelDialog({ open: false, id: null });
    try {
      await axiosClient.post(`/auth/leave-requests/${id}/cancel/`);
      setSuccess('Leave request cancelled. HR has been notified.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel leave');
    }
  };

  const canCancel = (r) => {
    if (r.status !== 'approved') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(r.start_date) > today;
  };

  const allCount = requests.length;
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const approvedCount = requests.filter((request) => request.status === 'approved').length;
  const rejectedCount = requests.filter((request) => ['rejected', 'cancelled_by_user'].includes(request.status)).length;

  const filteredRequests = tab === 0 ? requests
    : tab === 1 ? requests.filter(r => r.status === 'pending')
    : tab === 2 ? requests.filter(r => r.status === 'approved')
    : requests.filter(r => ['rejected', 'cancelled_by_user'].includes(r.status));

  if (loading) return <LoadingSpinner />;

  // Aggregate all leave types for summary display
  const allBalances = balance?.balances ?? [];
  const allocatedFromBalance = allBalances.reduce((s, b) => s + (Number(b.quota) || 0), 0);
  const usedFromBalance = allBalances.reduce((s, b) => s + (Number(b.used) || 0), 0);
  const allocatedDays = Number(stats?.total_leave_days) || (allocatedFromBalance > 0 ? allocatedFromBalance : 45);
  const usedDays = Number(stats?.approved_days) || usedFromBalance;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>My Leave Requests</Typography>
        <Button variant="outlined" color="primary" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          New Request
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Allocated Days" value={allocatedDays} icon={EventNoteIcon} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Used Days" value={usedDays} icon={CheckCircleIcon} color={usedDays > allocatedDays ? '#d32f2f' : '#1565C0'} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Remaining Days" value={Math.max(0, allocatedDays - usedDays)} icon={PendingIcon} color="#1E88E5" />
        </Grid>
      </Grid>

      {usedDays > allocatedDays && (() => {
        const overdraft = allBalances.reduce((s, b) => s + (b.overdraft ?? 0), 0);
        const displayOD = overdraft > 0 ? overdraft : (usedDays - allocatedDays);
        return (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have exceeded your leave allocation by <strong>{displayOD.toFixed(1)} day(s)</strong>.
            Excess leave days will be deducted from your monthly salary at the per-diem rate.
          </Alert>
        );
      })()}

      <TabFilters
        tab={tab}
        onTabChange={setTab}
        tabs={[
          { key: 0, value: 0, label: 'All', count: allCount, colorKey: 'all' },
          { key: 1, value: 1, label: 'Pending', count: pendingCount, colorKey: 'pending' },
          { key: 2, value: 2, label: 'Approved', count: approvedCount, colorKey: 'accepted' },
          { key: 3, value: 3, label: 'Rejected / Cancelled', count: rejectedCount, colorKey: 'rejected' },
        ]}
        tabsSx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Days</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">No leave requests found</TableCell></TableRow>
            ) : (
              filteredRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.leave_type}
                    {r.is_half_day && (
                      <Chip label={`Half-day (${r.half_day_period})`} size="small" sx={{ ml: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>{formatDate(r.start_date)}</TableCell>
                  <TableCell>{formatDate(r.end_date)}</TableCell>
                  <TableCell>{r.is_half_day ? 'Half Day' : r.days}</TableCell>
                  <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {canCancel(r) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Cancel fontSize="small" />}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 108 }}
                        onClick={() => setCancelDialog({ open: true, id: r.id })}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>New Leave Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField select fullWidth label="Leave Type" value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.is_half_day}
                    onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
                  />
                }
                label="Half-day leave"
              />
            </Grid>
            {form.is_half_day ? (
              <>
                <Grid item xs={6}>
                  <TextField fullWidth label="Date" type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value })}
                    InputLabelProps={{ shrink: true }} required />
                </Grid>
                <Grid item xs={6}>
                  <TextField select fullWidth label="Period" value={form.half_day_period}
                    onChange={(e) => setForm({ ...form, half_day_period: e.target.value })}>
                    <MenuItem value="morning">Morning</MenuItem>
                    <MenuItem value="afternoon">Afternoon</MenuItem>
                  </TextField>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={6}>
                  <TextField fullWidth label="Start Date" type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    InputLabelProps={{ shrink: true }} required />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="End Date" type="date" value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    InputLabelProps={{ shrink: true }} required />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Reason" value={form.reason} multiline rows={3}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, id: null })}>
        <DialogTitle>Cancel Leave</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to cancel this approved leave? HR will be notified.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, id: null })}>No</Button>
          <Button color="error" variant="contained" onClick={handleCancel}>Yes, Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
