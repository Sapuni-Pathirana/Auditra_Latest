import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert,
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import removalService from '../../services/removalService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDate } from '../../utils/helpers';

export default function RemovalRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      const res = await removalService.getAllRequests();
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Failed to load removal requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id, action) => {
    setError('');
    setSuccess('');
    try {
      if (action === 'approve') await removalService.approveRequest(id);
      else await removalService.rejectRequest(id);
      setSuccess(`Request ${action}d`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Removal Requests</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Requested By</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No removal requests</TableCell></TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.employee_name || r.employee_username || '-'}</TableCell>
                  <TableCell>{r.requested_by_name || r.requested_by_username || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</TableCell>
                  <TableCell>{formatDate(r.created_at)}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button size="small" variant="outlined" color="primary" sx={{ width: 110 }} onClick={() => handleAction(r.id, 'approve')}>Approve</Button>
                        <Button size="small" variant="outlined" color="error" sx={{ width: 110 }} onClick={() => handleAction(r.id, 'reject')}>Reject</Button>
                      </Box>
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
