import { useState, useEffect, Fragment } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, Tabs, Tab, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Collapse, Grid, Chip
} from '@mui/material';
import {
  Check, Close, KeyboardArrowDown, KeyboardArrowUp
} from '@mui/icons-material';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDateTime } from '../../utils/helpers';

/* ------------------------------------------------------------------ */
/*  Detail field helper                                               */
/* ------------------------------------------------------------------ */
const DetailField = ({ label, value }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary',
        fontWeight: 600,
        display: 'block',
        mb: 0.5,
        textTransform: 'uppercase',
        fontSize: '0.65rem',
        letterSpacing: '0.8px'
      }}
    >
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word', fontSize: '0.95rem' }}>
      {value || '-'}
    </Typography>
  </Box>
);

export default function CancellationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // Dialog states (keep approve/reject dialogs since they need input)
  const [approveDialog, setApproveDialog] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');

  // All requests for counts
  const [allRequests, setAllRequests] = useState([]);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        projectService.getCancellationRequests('pending'),
        projectService.getCancellationRequests('approved'),
        projectService.getCancellationRequests('rejected'),
      ]);
      const all = [
        ...(pendingRes.data.requests || []),
        ...(approvedRes.data.requests || []),
        ...(rejectedRes.data.requests || []),
      ];
      setAllRequests(all);
      setRequests(all);
    } catch {
      setError('Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const handleApprove = async () => {
    if (!approveDialog) return;
    setProcessing(true);
    setError('');
    try {
      await projectService.approveCancellation(approveDialog.id, adminRemarks);
      setSuccess('Cancellation approved. Project has been cancelled and team notified.');
      setApproveDialog(null);
      setAdminRemarks('');
      fetchAllRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve cancellation');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !adminRemarks.trim()) {
      setError('Please provide remarks for rejection');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await projectService.rejectCancellation(rejectDialog.id, adminRemarks);
      setSuccess('Cancellation request rejected. Coordinator has been notified.');
      setRejectDialog(null);
      setAdminRemarks('');
      fetchAllRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject cancellation');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;

  const filtered = tab === 0 ? allRequests :
    tab === 1 ? allRequests.filter(r => r.status === 'pending') :
    tab === 2 ? allRequests.filter(r => r.status === 'approved') :
    allRequests.filter(r => r.status === 'rejected');

  if (loading) return <LoadingSpinner />;

  const colCount = 7;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Cancellation Requests</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${allRequests.length})`} />
        <Tab label={`Pending (${pendingCount})`} />
        <Tab label={`Approved (${approvedCount})`} />
        <Tab label={`Rejected (${rejectedCount})`} />
      </Tabs>

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Coordinator</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>No cancellation requests</TableCell></TableRow>
            ) : (
              filtered.map((request) => {
                const isExpanded = expandedRow === request.id;

                return (
                  <Fragment key={request.id}>
                    {/* Main Row */}
                    <TableRow
                      hover
                      sx={{ '& > *': { borderBottom: 'unset' } }}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <IconButton size="small" onClick={() => handleToggleExpand(request.id)}>
                          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{request.project_title}</TableCell>
                      <TableCell>{request.coordinator_name}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {request.reason}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatDateTime(request.created_at)}
                      </TableCell>
                      <TableCell><StatusChip status={request.status} /></TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {request.status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<Check />}
                              onClick={() => { setAdminRemarks(''); setApproveDialog(request); }}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Close />}
                              onClick={() => { setAdminRemarks(''); setRejectDialog(request); }}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                            >
                              Reject
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Row */}
                    <TableRow>
                      <TableCell
                        colSpan={colCount}
                        sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 3, px: 3, bgcolor: (t) => t.palette.custom?.cardInner || '#FAFBFC' }}>
                            <Grid container spacing={4}>
                              {/* Request Information */}
                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Information
                                </Typography>
                                <DetailField label="Project" value={request.project_title} />
                                <DetailField label="Project Status" value={request.project_status} />
                              </Grid>

                              {/* Requester Information */}
                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Requester Details
                                </Typography>
                                <DetailField label="Requested By" value={request.coordinator_name} />
                                <DetailField label="Request Date" value={formatDateTime(request.created_at)} />
                              </Grid>

                              {/* Reason */}
                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Cancellation Details
                                </Typography>
                                <Box sx={{ mb: 2 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      fontWeight: 600,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      fontSize: '0.65rem',
                                      letterSpacing: '0.8px'
                                    }}
                                  >
                                    Reason for Cancellation
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      fontSize: '0.95rem',
                                      bgcolor: 'background.paper',
                                      p: 1.5,
                                      borderRadius: 1,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                    }}
                                  >
                                    {request.reason || '-'}
                                  </Typography>
                                </Box>
                              </Grid>

                              {/* Status & Review */}
                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Review Status
                                </Typography>
                                <Box sx={{ mb: 2.5 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      fontWeight: 600,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      fontSize: '0.65rem',
                                      letterSpacing: '0.8px'
                                    }}
                                  >
                                    Status
                                  </Typography>
                                  <StatusChip status={request.status} />
                                </Box>
                                {request.status !== 'pending' && (
                                  <>
                                    <DetailField label="Reviewed By" value={request.reviewed_by_name} />
                                    <DetailField label="Review Date" value={request.reviewed_at ? formatDateTime(request.reviewed_at) : '-'} />
                                    {request.admin_remarks && (
                                      <Box sx={{ mb: 2 }}>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: 'text.secondary',
                                            fontWeight: 600,
                                            display: 'block',
                                            mb: 0.5,
                                            textTransform: 'uppercase',
                                            fontSize: '0.65rem',
                                            letterSpacing: '0.8px'
                                          }}
                                        >
                                          Admin Remarks
                                        </Typography>
                                        <Typography
                                          variant="body1"
                                          sx={{
                                            fontWeight: 500,
                                            fontSize: '0.95rem',
                                            bgcolor: 'background.paper',
                                            p: 1.5,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                          }}
                                        >
                                          {request.admin_remarks}
                                        </Typography>
                                      </Box>
                                    )}
                                  </>
                                )}
                              </Grid>
                            </Grid>

                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onClose={() => !processing && setApproveDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'primary.main' }}>Approve Cancellation</DialogTitle>
        {approveDialog && (
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This will cancel the project "{approveDialog.project_title}" and notify all assigned team members.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              <strong>Reason:</strong> {approveDialog.reason}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Admin Remarks (Optional)"
              placeholder="Add any additional remarks..."
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
            />
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveDialog(null)} disabled={processing} sx={{ width: 110 }}>Cancel</Button>
          <Button variant="outlined" color="primary" onClick={handleApprove} disabled={processing} startIcon={<Check />} sx={{ width: 110 }}>
            {processing ? 'Processing...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onClose={() => !processing && setRejectDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Reject Cancellation Request</DialogTitle>
        {rejectDialog && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a reason for rejecting this cancellation request. The coordinator will be notified.
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Original Reason:</strong> {rejectDialog.reason}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Rejection Remarks"
              placeholder="Please explain why the cancellation request is being rejected..."
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              required
              error={!adminRemarks.trim() && !!rejectDialog}
            />
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialog(null)} disabled={processing} sx={{ width: 110 }}>Cancel</Button>
          <Button variant="outlined" color="error" onClick={handleReject} disabled={processing || !adminRemarks.trim()} startIcon={<Close />} sx={{ width: 110 }}>
            {processing ? 'Processing...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
