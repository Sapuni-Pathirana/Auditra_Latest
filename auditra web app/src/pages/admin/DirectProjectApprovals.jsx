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
import { formatDateTime, formatDate, formatCurrency, capitalize } from '../../utils/helpers';

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

export default function DirectProjectApprovals() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [summary, setSummary] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  const [approveDialog, setApproveDialog] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectService.getAdminPendingProjects('all');
      setProjects(res.data.projects || []);
      setSummary(res.data.summary || { total: 0, pending: 0, approved: 0, rejected: 0 });
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleApprove = async () => {
    if (!approveDialog) return;
    setProcessing(true);
    setError('');
    try {
      await projectService.adminApprove(approveDialog.id);
      setSuccess('Project approved successfully.');
      setApproveDialog(null);
      setAdminRemarks('');
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve project');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !adminRemarks.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await projectService.adminReject(rejectDialog.id, adminRemarks);
      setSuccess('Project rejected. Coordinator has been notified.');
      setRejectDialog(null);
      setAdminRemarks('');
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject project');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const filtered = tab === 0 ? projects :
    tab === 1 ? projects.filter(p => p.admin_approval_status === 'pending') :
    tab === 2 ? projects.filter(p => p.admin_approval_status === 'approved') :
    projects.filter(p => p.admin_approval_status === 'rejected');

  if (loading) return <LoadingSpinner />;

  const colCount = 8;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Direct Project Approvals</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review projects created directly by coordinators (without a client submission)
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${summary.total})`} />
        <Tab label={`Pending (${summary.pending})`} />
        <Tab label={`Approved (${summary.approved})`} />
        <Tab label={`Rejected (${summary.rejected})`} />
      </Tabs>

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 700 }}>Project Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Coordinator</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Est. Value</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>No projects found</TableCell></TableRow>
            ) : (
              filtered.map((project) => {
                const isExpanded = expandedRow === project.id;

                return (
                  <Fragment key={project.id}>
                    <TableRow
                      hover
                      sx={{ '& > *': { borderBottom: 'unset' } }}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <IconButton size="small" onClick={() => handleToggleExpand(project.id)}>
                          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{project.title}</TableCell>
                      <TableCell>{project.coordinator_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={capitalize(project.priority) || 'Normal'}
                          size="small"
                          color={project.priority === 'high' ? 'error' : project.priority === 'medium' ? 'warning' : 'default'}
                          sx={{ width: 110, justifyContent: 'center' }}
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(project.estimated_value)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatDateTime(project.created_at)}
                      </TableCell>
                      <TableCell><StatusChip status={project.admin_approval_status} /></TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {project.admin_approval_status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<Check />}
                              onClick={() => { setAdminRemarks(''); setApproveDialog(project); }}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<Close />}
                              onClick={() => { setAdminRemarks(''); setRejectDialog(project); }}
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

                    <TableRow>
                      <TableCell
                        colSpan={colCount}
                        sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 3, px: 3, bgcolor: (t) => t.palette.custom?.cardInner || '#FAFBFC' }}>
                            <Grid container spacing={4}>
                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Details
                                </Typography>
                                <DetailField label="Title" value={project.title} />
                                <DetailField label="Description" value={project.description} />
                                <DetailField label="Priority" value={capitalize(project.priority)} />
                              </Grid>

                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Dates & Value
                                </Typography>
                                <DetailField label="Start Date" value={formatDate(project.start_date)} />
                                <DetailField label="End Date" value={formatDate(project.end_date)} />
                                <DetailField label="Estimated Value" value={formatCurrency(project.estimated_value)} />
                              </Grid>

                              <Grid item xs={12} md={3}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Client Information
                                </Typography>
                                <DetailField label="Client Name" value={project.client_info?.name} />
                                <DetailField label="Client Email" value={project.client_info?.email} />
                                <DetailField label="Client Phone" value={project.client_info?.phone} />
                                <DetailField label="Company" value={project.client_info?.company} />
                              </Grid>

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
                                  <StatusChip status={project.admin_approval_status} />
                                </Box>
                                {project.admin_approval_status !== 'pending' && (
                                  <>
                                    <DetailField label="Reviewed By" value={project.admin_approved_by_name} />
                                    <DetailField label="Review Date" value={
                                      project.admin_approved_at ? formatDateTime(project.admin_approved_at) :
                                      project.admin_rejected_at ? formatDateTime(project.admin_rejected_at) : '-'
                                    } />
                                    {project.admin_rejection_reason && (
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
                                          Rejection Reason
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
                                          {project.admin_rejection_reason}
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
        <DialogTitle sx={{ fontWeight: 700, color: 'primary.main' }}>Approve Project</DialogTitle>
        {approveDialog && (
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              This will approve the direct project "{approveDialog.title}" created by {approveDialog.coordinator_name}.
              The coordinator will be able to proceed with the project workflow.
            </Alert>
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
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Reject Project</DialogTitle>
        {rejectDialog && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a reason for rejecting this project. The coordinator will be notified.
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Project:</strong> {rejectDialog.title} by {rejectDialog.coordinator_name}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Rejection Reason"
              placeholder="Please explain why this project is being rejected..."
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
