import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, InputAdornment,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Divider
} from '@mui/material';
import { Search, Cancel, Visibility, Send } from '@mui/icons-material';
import valuationService from '../../services/valuationService';
import StatusChip from '../../components/StatusChip';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate, formatCurrency } from '../../utils/helpers';

const STATUS_TAB_MAP = { pending: 1, approved: 2, rejected: 3 };

export default function ValuationReview() {
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [tabValue, setTabValue] = useState(STATUS_TAB_MAP[location.state?.filter] || 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detailDialog, setDetailDialog] = useState({ open: false, valuation: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchValuations(); }, []);

  const fetchValuations = async () => {
    try {
      setLoading(true);
      const res = await valuationService.getValuations();
      setValuations(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {
      setSnackbar({ open: true, message: 'Failed to load valuations', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndSend = async (id) => {
    try {
      setActionLoading(true);
      await valuationService.approveValuation(id, { senior_valuer_comments: remarks });
      setSnackbar({ open: true, message: 'Valuation approved and sent to MD/GM for final approval', severity: 'success' });
      setRemarks('');
      setDetailDialog({ open: false, valuation: null });
      fetchValuations();
    } catch {
      setSnackbar({ open: true, message: 'Failed to approve valuation', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!remarks.trim()) {
      setSnackbar({ open: true, message: 'Rejection reason is required', severity: 'warning' });
      return;
    }
    try {
      setActionLoading(true);
      await valuationService.seniorValuerReject(id, { rejection_reason: remarks });
      setSnackbar({ open: true, message: 'Valuation rejected successfully', severity: 'success' });
      setRemarks('');
      setDetailDialog({ open: false, valuation: null });
      fetchValuations();
    } catch {
      setSnackbar({ open: true, message: 'Failed to reject valuation', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const isPending = (status) => status === 'pending' || status === 'submitted' || status === 'reviewed';

  const filteredValuations = valuations.filter(v => {
    const statusMatch = tabValue === 0 ||
      (tabValue === 1 && isPending(v.status)) ||
      (tabValue === 2 && v.status === 'approved') ||
      (tabValue === 3 && v.status === 'rejected');
    const searchMatch = !searchQuery ||
      (v.project_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.field_officer_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Valuation Review</Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`All (${valuations.length})`} />
          <Tab label={`Pending (${valuations.filter(v => isPending(v.status)).length})`} />
          <Tab label={`Approved (${valuations.filter(v => v.status === 'approved').length})`} />
          <Tab label={`Rejected (${valuations.filter(v => v.status === 'rejected').length})`} />
        </Tabs>
      </Paper>

      <TextField
        placeholder="Search by project or field officer..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
        }}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Field Officer</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Valuation Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date Submitted</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredValuations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No valuations found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredValuations.map((val) => (
                <TableRow key={val.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{val.project_title || 'N/A'}</TableCell>
                  <TableCell>{val.field_officer_name || val.field_officer_username || 'N/A'}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{val.category_display || val.category || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(val.estimated_value)}</TableCell>
                  <TableCell>{formatDate(val.submitted_at || val.created_at)}</TableCell>
                  <TableCell>
                    <StatusChip status={val.status} label={val.status} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Visibility />} sx={{ width: 110 }}
                      onClick={() => { setDetailDialog({ open: true, valuation: val }); setRemarks(''); }}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, valuation: null })} maxWidth="md" fullWidth>
        <DialogTitle>Valuation Review</DialogTitle>
        <DialogContent dividers>
          {detailDialog.valuation && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Project</Typography>
                  <Typography>{detailDialog.valuation.project_title}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Field Officer</Typography>
                  <Typography>{detailDialog.valuation.field_officer_name || detailDialog.valuation.field_officer_username}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Valuation Type</Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>{detailDialog.valuation.category_display || detailDialog.valuation.category}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Estimated Value</Typography>
                  <Typography>{formatCurrency(detailDialog.valuation.estimated_value)}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography>{detailDialog.valuation.description || 'No description provided'}</Typography>
              </Box>
              {detailDialog.valuation.accessor_comments && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Accessor Comments</Typography>
                  <Alert severity="info" sx={{ mt: 0.5 }}>
                    {detailDialog.valuation.accessor_comments}
                  </Alert>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <StatusChip status={detailDialog.valuation.status} label={detailDialog.valuation.status} />
              </Box>
              {detailDialog.valuation.rejection_reason && detailDialog.valuation.status === 'rejected' && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Rejection Reason</Typography>
                  <Alert severity="warning" sx={{ mt: 0.5 }}>
                    {detailDialog.valuation.rejection_reason}
                  </Alert>
                </Box>
              )}

              {isPending(detailDialog.valuation.status) && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <TextField
                    label="Comments (required for rejection)"
                    placeholder="Add your comments here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                  />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {detailDialog.valuation && isPending(detailDialog.valuation.status) && (
            <>
              <Button color="error" startIcon={<Cancel />} sx={{ width: 110 }}
                disabled={actionLoading}
                onClick={() => handleReject(detailDialog.valuation.id)}>
                Reject
              </Button>
              <Button color="primary" variant="outlined" startIcon={<Send />} sx={{ width: 110 }}
                disabled={actionLoading}
                onClick={() => handleApproveAndSend(detailDialog.valuation.id)}>
                Approve & Send to MD/GM
              </Button>
            </>
          )}
          <Button sx={{ width: 110 }} onClick={() => setDetailDialog({ open: false, valuation: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
