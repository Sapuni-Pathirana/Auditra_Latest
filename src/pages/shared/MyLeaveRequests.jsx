import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tabs, Tab,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import leaveService from '../../services/leaveService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import StatsCard from '../../components/StatsCard';
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

export default function MyLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const TOTAL_LEAVE_DAYS = 45;

  const fetchData = async () => {
    try {
      const reqRes = await leaveService.getMyRequests();
      setRequests(Array.isArray(reqRes.data.data) ? reqRes.data.data : []);
    } catch (err) {
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
      await leaveService.createRequest(form);
      setSuccess('Leave request submitted!');
      setDialogOpen(false);
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = tab === 0 ? requests :
    tab === 1 ? requests.filter(r => r.status === 'pending') :
      tab === 2 ? requests.filter(r => r.status === 'approved') :
        requests.filter(r => r.status === 'rejected');

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>My Leave Requests</Typography>
        <Button variant="outlined" color="primary" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Request</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Total Leave Days" value={TOTAL_LEAVE_DAYS} icon={EventNoteIcon} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Approved Leave Requests" value={requests.filter(r => r.status === 'approved').length} icon={CheckCircleIcon} color="#1565C0" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatsCard title="Pending Leave Requests" value={requests.filter(r => r.status === 'pending').length} icon={PendingIcon} color="#1E88E5" />
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="All" />
        <Tab label="Pending" />
        <Tab label="Approved" />
        <Tab label="Rejected" />
      </Tabs>

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '15%' }}>Type</TableCell>
              <TableCell sx={{ width: '18%' }}>From</TableCell>
              <TableCell sx={{ width: '18%' }}>To</TableCell>
              <TableCell sx={{ width: '34%' }}>Reason</TableCell>
              <TableCell sx={{ width: '15%' }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No leave requests found</TableCell></TableRow>
            ) : (
              filteredRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.leave_type}</TableCell>
                  <TableCell>{formatDate(r.start_date)}</TableCell>
                  <TableCell>{formatDate(r.end_date)}</TableCell>
                  <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell>
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
            <Grid item xs={6}>
              <TextField fullWidth label="Start Date" type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="End Date" type="date" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reason" value={form.reason} multiline rows={3}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined">Cancel</Button>
          <Button onClick={handleSubmit} variant="outlined" color="primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
