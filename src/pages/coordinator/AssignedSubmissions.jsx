import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, Chip,
  Button, InputAdornment, IconButton, CircularProgress, Collapse, Grid,
  Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Tabs, Tab, Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  AddCircle as AddCircleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  ContactPhone as AgentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import authService from '../../services/authService';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const RESPONSE_CHIP_COLORS = {
  pending: { bg: '#1E88E515', color: '#1E88E5', label: 'Pending' },
  accepted: { bg: '#1565C015', color: '#1565C0', label: 'Accepted' },
  rejected: { bg: '#DC262615', color: '#DC2626', label: 'Rejected' },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

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

/* ------------------------------------------------------------------ */
/*  Section Card Component                                            */
/* ------------------------------------------------------------------ */
const InfoSection = ({ title, icon: Icon, children, color = 'primary.main' }) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'grey.200',
      borderRadius: 2,
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Icon sx={{ color, fontSize: 24 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color, fontSize: '1rem' }}>
          {title}
        </Typography>
      </Box>
      {children}
    </CardContent>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function AssignedSubmissions() {
  const navigate = useNavigate();

  /* ---- state ---- */
  const [submissions, setSubmissions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summaryCounts, setSummaryCounts] = useState({ all: 0, pending: 0, accepted: 0, rejected: 0 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [responseFilter, setResponseFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  
  /* ---- rejection dialog state ---- */
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  /* ---- snackbar state ---- */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /* ================================================================
     Fetch submissions
     ================================================================ */
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search) params.search = search;
      if (responseFilter) params.coordinator_response = responseFilter;

      const res = await axiosClient.get('/auth/client-submissions/', { params });
      setSubmissions(res.data.results || []);
      setTotalCount(res.data.count || 0);
      
      // Also fetch total counts without filter for tab badges
      const allRes = await axiosClient.get('/auth/client-submissions/', { params: { page: 1, page_size: 1 } });
      const allSubmissions = allRes.data.results || [];
      // Get counts from a full fetch
      const countRes = await axiosClient.get('/auth/client-submissions/', { params: { page_size: 1000 } });
      const allData = countRes.data.results || [];
      setSummaryCounts({
        all: countRes.data.count || 0,
        pending: allData.filter(s => s.coordinator_response === 'pending').length,
        accepted: allData.filter(s => s.coordinator_response === 'accepted').length,
        rejected: allData.filter(s => s.coordinator_response === 'rejected').length,
      });
    } catch {
      setSubmissions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, responseFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /* ================================================================
     Handlers
     ================================================================ */
  const handleToggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const handleAccept = async (submission) => {
    setActionLoading(true);
    try {
      await authService.acceptAssignment(submission.id);
      setSnackbar({
        open: true,
        message: 'Assignment accepted! Click "Create Project" to create a project.',
        severity: 'success'
      });
      fetchSubmissions();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to accept assignment',
        severity: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectDialog = (submission) => {
    setSelectedSubmission(submission);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setSnackbar({
        open: true,
        message: 'Please provide a reason for rejection',
        severity: 'warning'
      });
      return;
    }
    
    setActionLoading(true);
    try {
      await authService.rejectAssignment(selectedSubmission.id, rejectionReason);
      setSnackbar({
        open: true,
        message: 'Assignment rejected. Admin has been notified for reassignment.',
        severity: 'info'
      });
      setRejectDialogOpen(false);
      setSelectedSubmission(null);
      setRejectionReason('');
      fetchSubmissions();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to reject assignment',
        severity: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateProject = (submission) => {
    navigate('/dashboard/projects/create', {
      state: {
        submissionData: submission,
        submissionId: submission.id,
      },
    });
  };

  const handlePageChange = (_, newPage) => setPage(newPage);

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleTabChange = (_, newValue) => {
    setResponseFilter(newValue);
    setPage(0);
  };

  /* ================================================================
     Render
     ================================================================ */
  const colCount = 7;

  const pendingCount = summaryCounts.pending;
  const acceptedCount = summaryCounts.accepted;
  const rejectedCount = summaryCounts.rejected;

  return (
    <Box>
      {/* ---- Page Title ---- */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Assigned Submissions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review and respond to client submissions assigned to you
        </Typography>
      </Box>

      {/* ---- Response Filter Tabs ---- */}
      <Tabs 
        value={responseFilter} 
        onChange={handleTabChange}
        sx={{ 
          mb: 2,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 48,
          }
        }}
      >
        <Tab value="" label={`All (${summaryCounts.all})`} />
        <Tab 
          value="pending" 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Pending
              {pendingCount > 0 && (
                <Chip 
                  label={pendingCount} 
                  size="small" 
                  sx={{
                    bgcolor: '#1E88E515',
                    color: '#1E88E5',
                    fontWeight: 700,
                    height: 20,
                    border: '1px solid #1E88E550',
                    '& .MuiChip-label': { px: 1 }
                  }} 
                />
              )}
            </Box>
          } 
        />
        <Tab value="accepted" label={`Accepted (${acceptedCount})`} />
        <Tab value="rejected" label={`Rejected (${rejectedCount})`} />
      </Tabs>

      {/* ---- Search Toolbar ---- */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by name, email, company, project..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 350, flexGrow: 1 }}
        />
      </Paper>

      {/* ---- Data Table ---- */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Project Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Response Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Submitted</TableCell>
              <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 8 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Loading submissions...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 8 }}>
                  <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    No submissions found
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Submissions assigned to you will appear here
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((sub) => {
                const isExpanded = expandedRow === sub.id;
                const fullName = [sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'Unknown';
                const responseStatus = sub.coordinator_response || 'pending';
                const responseChip = RESPONSE_CHIP_COLORS[responseStatus] || RESPONSE_CHIP_COLORS.pending;
                // Show Accept/Reject when coordinator hasn't responded yet
                const canRespond = responseStatus === 'pending';
                // Show Create when coordinator accepted but project not yet created
                const canCreateProject = responseStatus === 'accepted' && !sub.project_created;
                // Show Project Created status when project has been created
                const projectCreated = responseStatus === 'accepted' && sub.project_created;
                // Rejected by this coordinator
                const isRejected = responseStatus === 'rejected';

                return (
                  <Fragment key={sub.id}>
                    {/* ---- Main row ---- */}
                    <TableRow
                      hover
                      sx={{
                        '& > *': { borderBottom: '1px solid', borderColor: 'divider' },
                        bgcolor: canRespond ? 'warning.50' : 'inherit',
                      }}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <IconButton size="small" onClick={() => handleToggleExpand(sub.id)}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">{sub.email}</Typography>
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500 }}
                        >
                          {sub.project_title || '-'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sub.company_name || '-'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={responseChip.label}
                          size="small"
                          sx={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            bgcolor: responseChip.bg,
                            color: responseChip.color,
                            border: `1px solid ${responseChip.color}50`,
                            width: 100,
                            justifyContent: 'center',
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {formatDate(sub.submitted_at)}
                      </TableCell>

                      <TableCell sx={{ minWidth: 200 }}>
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                          {canRespond && (
                            <>
                              <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleAccept(sub)}
                                disabled={actionLoading}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  width: 100,
                                }}
                              >
                                Accept
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<CancelIcon />}
                                onClick={() => handleOpenRejectDialog(sub)}
                                disabled={actionLoading}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 600,
                                  width: 100,
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {canCreateProject && (
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              startIcon={<AddCircleIcon />}
                              onClick={() => handleCreateProject(sub)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                width: 100,
                              }}
                            >
                              Create
                            </Button>
                          )}
                          {projectCreated && (
                            <Chip
                              icon={<CheckCircleIcon sx={{ color: '#1565C0 !important', fontSize: 16 }} />}
                              label="Created"
                              size="small"
                              sx={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                bgcolor: 'transparent',
                                color: '#1565C0',
                                border: '1px solid #1565C0',
                                '& .MuiChip-icon': { color: '#1565C0' },
                                width: 100,
                                justifyContent: 'center',
                              }}
                            />
                          )}
                          {isRejected && (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                              -
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>

                    {/* ---- Expandable detail row ---- */}
                    <TableRow>
                      <TableCell
                        colSpan={colCount}
                        sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 3, px: 3 }}>
                            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
                              {/* Client Information */}
                              <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Client Information
                                </Typography>
                                <DetailField label="Full Name" value={fullName} />
                                <DetailField label="Email" value={sub.email} />
                                <DetailField label="Phone" value={sub.phone} />
                                <DetailField label="NIC" value={sub.nic} />
                              </Box>

                              {/* Company Details */}
                              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Company Details
                                </Typography>
                                <DetailField label="Company" value={sub.company_name} />
                                <DetailField label="Address" value={sub.address} />
                              </Box>

                              {/* Project Details */}
                              <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Details
                                </Typography>
                                <DetailField label="Project Title" value={sub.project_title} />
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
                                    Description
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
                                    {sub.project_description || '-'}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Agent Information */}
                              <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Agent Information
                                </Typography>
                                {sub.agent_name || sub.agent_email || sub.agent_phone ? (
                                  <>
                                    <DetailField label="Agent Name" value={sub.agent_name || 'Not provided'} />
                                    <DetailField label="Agent Email" value={sub.agent_email || 'Not provided'} />
                                    <DetailField label="Agent Phone" value={sub.agent_phone || 'Not provided'} />
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No agent is assigned to this project
                                  </Typography>
                                )}
                              </Box>
                            </Box>
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

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>

      {/* ---- Rejection Dialog ---- */}
      <Dialog 
        open={rejectDialogOpen} 
        onClose={() => !actionLoading && setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
            Reject Assignment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this assignment. The admin will be notified and can reassign a different coordinator.
          </Typography>
          {selectedSubmission && (
            <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {selectedSubmission.project_title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Client: {[selectedSubmission.first_name, selectedSubmission.last_name].filter(Boolean).join(' ')}
              </Typography>
            </Paper>
          )}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Reason"
            placeholder="Please explain why you are rejecting this assignment..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
            error={rejectDialogOpen && !rejectionReason.trim()}
            helperText={rejectDialogOpen && !rejectionReason.trim() ? 'Rejection reason is required' : ''}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setRejectDialogOpen(false)}
            disabled={actionLoading}
            sx={{ textTransform: 'none', width: 100 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={actionLoading || !rejectionReason.trim()}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Submit Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Snackbar ---- */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
