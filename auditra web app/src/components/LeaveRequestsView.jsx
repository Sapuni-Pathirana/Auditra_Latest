import { useState, useEffect, Fragment } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, TextField, InputAdornment,
  IconButton, Collapse, Chip, Stack,
} from '@mui/material';
import { Check, Close, Search, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import leaveService from '../services/leaveService';
import LoadingSpinner from './LoadingSpinner';
import StatusChip from './StatusChip';
import TabFilters from './TabFilters';
import { formatDate } from '../utils/helpers';

export default function LeaveRequestsView({
  title = 'Leave Management',
  subtitle = '',
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

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

  const toggleRowExpanded = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: subtitle ? 1 : 3 }}>{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {subtitle}
        </Typography>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TabFilters
        tab={tab}
        onTabChange={setTab}
        tabs={[
          { key: 0, value: 0, label: 'All', count: requests.length, colorKey: 'all' },
          { key: 1, value: 1, label: 'Pending', count: requests.filter(r => r.status === 'pending').length, colorKey: 'pending' },
          { key: 2, value: 2, label: 'Approved', colorKey: 'accepted' },
          { key: 3, value: 3, label: 'Rejected', colorKey: 'rejected' },
        ]}
        tabsSx={{ mb: 2 }}
      />

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
              <TableCell sx={{ width: 40 }} />
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
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No requests found</Typography>
              </TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <Fragment key={r.id}>
                  <TableRow hover>
                    <TableCell sx={{ py: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleRowExpanded(r.id)}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: expandedRows[r.id] ? 'action.selected' : 'background.paper',
                        }}
                      >
                        {expandedRows[r.id] ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.user_username || r.employee_name || '-'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {r.leave_type}
                      {r.is_half_day && (
                        <Chip label={`Half Day ${r.half_day_period || ''}`.trim()} size="small" sx={{ ml: 0.75 }} />
                      )}
                    </TableCell>
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
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, borderBottom: expandedRows[r.id] ? undefined : 0, bgcolor: 'background.default' }}>
                      <Collapse in={!!expandedRows[r.id]} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2.5, my: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr 1fr' },
                              gap: 2.5,
                            }}
                          >
                            <Stack spacing={1.4}>
                              <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Employee Information</Typography>
                              <Typography variant="body2"><strong>Name:</strong> {r.user_name || r.user_username || r.employee_name || '-'}</Typography>
                              <Typography variant="body2"><strong>Employee ID:</strong> {r.employee_id || r.employee_number || '-'}</Typography>
                            </Stack>

                            <Stack spacing={1.4}>
                              <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Leave Details</Typography>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}><strong>Type:</strong> {r.leave_type || '-'}</Typography>
                              <Typography variant="body2"><strong>Days:</strong> {r.is_half_day ? 'Half Day' : (r.days ?? '-')}</Typography>
                              <Typography variant="body2"><strong>Period:</strong> {formatDate(r.start_date)} - {formatDate(r.end_date)}</Typography>
                              {r.is_half_day && <Typography variant="body2"><strong>Half-Day:</strong> {(r.half_day_period || 'N/A').toString().replace('_', ' ')}</Typography>}
                            </Stack>

                            <Stack spacing={1.4}>
                              <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 700 }}>Review</Typography>
                              <Typography variant="body2"><strong>Status:</strong> <StatusChip status={r.status} /></Typography>
                              <Typography variant="body2"><strong>Reason:</strong> {r.reason || 'No reason provided'}</Typography>
                              {r.admin_remarks && <Typography variant="body2"><strong>Admin Remarks:</strong> {r.admin_remarks}</Typography>}
                            </Stack>
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
