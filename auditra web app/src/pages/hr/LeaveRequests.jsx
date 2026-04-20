import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, TextField, InputAdornment,
  Tabs, Tab, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, CircularProgress
} from '@mui/material';
import { Search, Check, Close, Visibility } from '@mui/icons-material';
import leaveService from '../../services/leaveService';
import StatusChip from '../../components/StatusChip';
import { formatDate } from '../../utils/helpers';

export default function LeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });

  const statusFilters = ['all', 'pending', 'approved', 'rejected'];

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await leaveService.getAllRequests();
      setRequests(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load leave requests', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await leaveService.updateRequest(id, { status });
      setSnackbar({ open: true, message: `Request ${status} successfully`, severity: 'success' });
      fetchRequests();
    } catch (err) {
      setSnackbar({ open: true, message: `Failed to ${status} request`, severity: 'error' });
    }
  };

  const filteredRequests = requests.filter(r => {
    const statusMatch = tabValue === 0 || r.status === statusFilters[tabValue];
    const q = searchQuery.toLowerCase();
    const searchMatch = !searchQuery ||
      (r.user_name || r.employee_name || '').toLowerCase().includes(q) ||
      (r.employee_id || '').toString().toLowerCase().includes(q) ||
      (r.leave_type || '').toLowerCase().includes(q);
    return statusMatch && searchMatch;
  });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Leave Requests</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review and manage employee leave requests
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`All (${requests.length})`} />
          <Tab label={`Pending (${requests.filter(r => r.status === 'pending').length})`} />
          <Tab label={`Approved (${requests.filter(r => r.status === 'approved').length})`} />
          <Tab label={`Rejected (${requests.filter(r => r.status === 'rejected').length})`} />
        </Tabs>
      </Paper>

      <TextField
        placeholder="Search by employee name, employee ID, or leave type..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
        }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Leave Type</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No leave requests found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((req) => (
                <TableRow key={req.id} hover>
                  <TableCell>{req.user_name || req.employee_name || 'N/A'}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{req.leave_type || 'N/A'}</TableCell>
                  <TableCell>{formatDate(req.start_date)}</TableCell>
                  <TableCell>{formatDate(req.end_date)}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.reason || '-'}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={req.status} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <IconButton size="small" color="primary" onClick={() => setDetailDialog({ open: true, request: req })}>
                        <Visibility fontSize="small" />
                      </IconButton>
                      {req.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<Check />}
                            onClick={() => handleAction(req.id, 'approved')}
                            sx={{ width: 110 }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<Close />}
                            onClick={() => handleAction(req.id, 'rejected')}
                            sx={{ width: 110 }}
                          >
                            Reject
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, request: null })} maxWidth="sm" fullWidth>
        <DialogTitle>Leave Request Details</DialogTitle>
        <DialogContent dividers>
          {detailDialog.request && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box><Typography variant="subtitle2" color="text.secondary">Employee</Typography><Typography>{detailDialog.request.user_name || detailDialog.request.employee_name}</Typography></Box>
              <Box><Typography variant="subtitle2" color="text.secondary">Leave Type</Typography><Typography sx={{ textTransform: 'capitalize' }}>{detailDialog.request.leave_type}</Typography></Box>
              <Box><Typography variant="subtitle2" color="text.secondary">Period</Typography><Typography>{formatDate(detailDialog.request.start_date)} - {formatDate(detailDialog.request.end_date)}</Typography></Box>
              <Box><Typography variant="subtitle2" color="text.secondary">Reason</Typography><Typography>{detailDialog.request.reason || 'No reason provided'}</Typography></Box>
              <Box><Typography variant="subtitle2" color="text.secondary">Status</Typography><StatusChip status={detailDialog.request.status} /></Box>
              {detailDialog.request.admin_remarks && (
                <Box><Typography variant="subtitle2" color="text.secondary">Admin Remarks</Typography><Typography>{detailDialog.request.admin_remarks}</Typography></Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {detailDialog.request?.status === 'pending' && (
            <>
              <Button color="error" sx={{ width: 110 }} onClick={() => { handleAction(detailDialog.request.id, 'rejected'); setDetailDialog({ open: false, request: null }); }}>Reject</Button>
              <Button color="primary" variant="outlined" sx={{ width: 110 }} onClick={() => { handleAction(detailDialog.request.id, 'approved'); setDetailDialog({ open: false, request: null }); }}>Approve</Button>
            </>
          )}
          <Button sx={{ width: 110 }} onClick={() => setDetailDialog({ open: false, request: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
