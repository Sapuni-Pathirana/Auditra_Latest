import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, Tabs, Tab, TextField, InputAdornment,
} from '@mui/material';
import { Check, Close, Search } from '@mui/icons-material';
import leaveService from '../../services/leaveService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDate } from '../../utils/helpers';

export default function LeaveManagement() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const res = await leaveService.getAllRequests();
      setRequests(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id, status) => {
    setError('');
    setSuccess('');
    try {
      await leaveService.updateRequest(id, { status });
      setSuccess(`Leave request ${status}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  };

  const filtered = requests.filter(r => {
    const tabMatch = tab === 0 ||
      (tab === 1 && r.status === 'pending') ||
      (tab === 2 && r.status === 'approved') ||
      (tab === 3 && r.status === 'rejected');
    const q = searchQuery.toLowerCase().trim();
    const searchMatch = !q ||
      (r.user_username || r.user_name || r.employee_name || '').toLowerCase().includes(q) ||
      (r.employee_id || r.employee_number || '').toString().toLowerCase().includes(q);
    return tabMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Leave Management</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${requests.length})`} />
        <Tab label={`Pending (${requests.filter(r => r.status === 'pending').length})`} />
        <Tab label="Approved" />
        <Tab label="Rejected" />
      </Tabs>

      <TextField
        placeholder="Search by employee name or employee ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search color="action" /></InputAdornment>,
        }}
      />

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Employee</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>From</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>To</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Reason</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No requests found</Typography>
              </TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.user_username || r.employee_name || '-'}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{r.leave_type}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.start_date)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.end_date)}</TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}><StatusChip status={r.status} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {r.status === 'pending' ? (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button size="small" variant="outlined" color="primary" startIcon={<Check />}
                          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleAction(r.id, 'approved')}>Approve</Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<Close />}
                          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleAction(r.id, 'rejected')}>Reject</Button>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
