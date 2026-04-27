import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, InputAdornment,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider,
} from '@mui/material';
import { Search, Cancel, Visibility } from '@mui/icons-material';
import StatusChip from './StatusChip';
import LoadingSpinner from './LoadingSpinner';
import TabFilters from './TabFilters';
import { formatDate, formatCurrency } from '../utils/helpers';

const STATUS_TAB_MAP = { pending: 1, approved: 2, rejected: 3 };

export default function ValuationReviewPage({
  initialFilter,
  fetchValuations,
  pendingPredicate,
  approvedPredicate,
  rejectedPredicate,
  mapStatusForChip = (status) => ({ status, label: status }),
  approveActionConfig,
  rejectActionConfig,
  remarksField,
  remarksRequiredForReject = true,
  remarksLabel = 'Comments (required for rejection)',
  renderExtraDetails,
}) {
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(STATUS_TAB_MAP[initialFilter] || 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detailDialog, setDetailDialog] = useState({ open: false, valuation: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const allCount = valuations.length;
  const pendingCount = valuations.filter((v) => pendingPredicate(v.status)).length;
  const approvedCount = valuations.filter((v) => approvedPredicate(v.status)).length;
  const rejectedCount = valuations.filter((v) => rejectedPredicate(v.status)).length;

  const reloadValuations = async () => {
    try {
      setLoading(true);
      const res = await fetchValuations();
      setValuations(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {
      setSnackbar({ open: true, message: 'Failed to load valuations', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadValuations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      const payload = approveActionConfig.buildPayload(remarks);
      await approveActionConfig.action(id, payload);
      setSnackbar({ open: true, message: approveActionConfig.successMessage, severity: 'success' });
      setRemarks('');
      setDetailDialog({ open: false, valuation: null });
      reloadValuations();
    } catch {
      setSnackbar({ open: true, message: approveActionConfig.errorMessage, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (remarksRequiredForReject && !remarks.trim()) {
      setSnackbar({ open: true, message: 'Rejection reason is required', severity: 'warning' });
      return;
    }
    try {
      setActionLoading(true);
      const payload = rejectActionConfig.buildPayload(remarks);
      await rejectActionConfig.action(id, payload);
      setSnackbar({ open: true, message: rejectActionConfig.successMessage, severity: 'success' });
      setRemarks('');
      setDetailDialog({ open: false, valuation: null });
      reloadValuations();
    } catch {
      setSnackbar({ open: true, message: rejectActionConfig.errorMessage, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredValuations = valuations.filter((v) => {
    const statusMatch = tabValue === 0 ||
      (tabValue === 1 && pendingPredicate(v.status)) ||
      (tabValue === 2 && approvedPredicate(v.status)) ||
      (tabValue === 3 && rejectedPredicate(v.status));
    const searchMatch = !searchQuery ||
      (v.project_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.field_officer_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;

  const canReview = detailDialog.valuation && pendingPredicate(detailDialog.valuation.status);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Valuation Review</Typography>

      <Paper sx={{ mb: 3 }}>
        <TabFilters
          tab={tabValue}
          onTabChange={setTabValue}
          tabs={[
            { key: 0, value: 0, label: 'All', count: allCount, colorKey: 'all' },
            { key: 1, value: 1, label: 'Pending', count: pendingCount, colorKey: 'pending' },
            { key: 2, value: 2, label: 'Approved', count: approvedCount, colorKey: 'accepted' },
            { key: 3, value: 3, label: 'Rejected', count: rejectedCount, colorKey: 'rejected' },
          ]}
          tabsSx={{ borderBottom: 1, borderColor: 'divider' }}
        />
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
              filteredValuations.map((val) => {
                const chip = mapStatusForChip(val.status);
                return (
                  <TableRow key={val.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{val.project_title || 'N/A'}</TableCell>
                    <TableCell>{val.field_officer_name || val.field_officer_username || 'N/A'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{val.category_display || val.category || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(val.estimated_value)}</TableCell>
                    <TableCell>{formatDate(val.submitted_at || val.created_at)}</TableCell>
                    <TableCell>
                      <StatusChip status={chip.status} label={chip.label} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        sx={{ width: 110 }}
                        onClick={() => {
                          setDetailDialog({ open: true, valuation: val });
                          setRemarks('');
                        }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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

              {renderExtraDetails?.(detailDialog.valuation)}

              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                {(() => {
                  const chip = mapStatusForChip(detailDialog.valuation.status);
                  return <StatusChip status={chip.status} label={chip.label} />;
                })()}
              </Box>

              {detailDialog.valuation.rejection_reason && detailDialog.valuation.status === 'rejected' && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Rejection Reason</Typography>
                  <Alert severity="warning" sx={{ mt: 0.5 }}>
                    {detailDialog.valuation.rejection_reason}
                  </Alert>
                </Box>
              )}

              {canReview && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <TextField
                    label={remarksLabel}
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
          {canReview && (
            <>
              <Button
                color="error"
                startIcon={<Cancel />}
                sx={{ width: 110 }}
                disabled={actionLoading}
                onClick={() => handleReject(detailDialog.valuation.id)}
              >
                Reject
              </Button>
              <Button
                color="primary"
                variant="outlined"
                startIcon={approveActionConfig.icon}
                sx={{ width: 200 }}
                disabled={actionLoading}
                onClick={() => handleApprove(detailDialog.valuation.id)}
              >
                {approveActionConfig.label}
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
