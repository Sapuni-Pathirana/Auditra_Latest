import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, MenuItem, Chip, Alert,
  Button, Snackbar, InputAdornment, CircularProgress, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, IconButton,
  List, ListItemButton, ListItemText, ListItemIcon, Radio, Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  PersonAdd as PersonAddIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  Replay as ReplayIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import PendingIcon from '@mui/icons-material/Pending';
import axiosClient from '../../api/axiosClient';
import StatsCard from '../../components/StatsCard';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_CHIP_COLORS = {
  pending: '#1E88E5',
  reviewed: '#0D47A1',
  rejected: '#DC2626',
  approved: '#1565C0',
  assigned: '#1565C0',
};

/* Map internal statuses to display statuses */
const getDisplayStatus = (status) => {
  return status;
};

const COORDINATOR_RESPONSE_CONFIG = {
  pending: { label: 'Awaiting', color: '#1E88E5', bg: '#1E88E515', icon: HourglassIcon },
  accepted: { label: 'Accepted', color: '#1565C0', bg: '#1565C015', icon: CheckCircleIcon },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#DC262615', icon: CancelIcon },
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
/*  Detail Field (for expandable row)                                  */
/* ------------------------------------------------------------------ */

const DetailField = ({ label, value }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography
      variant="caption"
      sx={{ 
        color: 'text.secondary', 
        fontWeight: 600, 
        display: 'block', 
        mb: 0.25,
        textTransform: 'uppercase',
        fontSize: '0.65rem',
        letterSpacing: '0.5px'
      }}
    >
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
      {value || '-'}
    </Typography>
  </Box>
);

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function ClientSubmissions() {
  /* ---- state ---- */
  const [submissions, setSubmissions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  /* expandable row */
  const [expandedId, setExpandedId] = useState(null);

  /* assign dialog */
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [coordinators, setCoordinators] = useState([]);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  /* approve */
  const [approveLoading, setApproveLoading] = useState(false);

  /* review mode – tracks which row is showing Accept/Reject */
  const [reviewingId, setReviewingId] = useState(null);

  /* reject dialog */
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmission, setRejectSubmission] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  /* snackbar */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /* ================================================================ */
  /*  Data fetching                                                    */
  /* ================================================================ */

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await axiosClient.get('/auth/client-submissions/', { params });
      setSubmissions(res.data.results || []);
      setTotalCount(res.data.count || 0);

      if (res.data.summary) {
        setSummary({
          total: res.data.summary.total ?? 0,
          pending: (res.data.summary.pending ?? 0) + (res.data.summary.reviewed ?? 0) + (res.data.summary.assigned ?? 0),
          approved: res.data.summary.approved ?? 0,
          rejected: res.data.summary.rejected ?? 0,
        });
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to load submissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  /* ================================================================ */
  /*  Expandable row toggle                                            */
  /* ================================================================ */

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ================================================================ */
  /*  Assign coordinator                                               */
  /* ================================================================ */

  const handleOpenAssignDialog = async (e, submission) => {
    e.stopPropagation();
    setSelectedSubmission(submission);
    setSelectedCoordinator(null);
    setAssignDialogOpen(true);

    try {
      const res = await axiosClient.get('/auth/coordinators/');
      setCoordinators(res.data.coordinators || res.data.results || res.data || []);
    } catch (err) {
      showSnackbar('Failed to load coordinators', 'error');
    }
  };

  const handleAssignCoordinator = async () => {
    if (!selectedSubmission || !selectedCoordinator) return;
    setAssignLoading(true);
    try {
      await axiosClient.post(
        `/auth/client-submissions/${selectedSubmission.id}/assign-coordinator/`,
        { coordinator_id: selectedCoordinator }
      );
      showSnackbar('Coordinator assigned successfully');
      setAssignDialogOpen(false);
      setSelectedSubmission(null);
      setSelectedCoordinator(null);
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to assign coordinator', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  /* ================================================================ */
  /*  Review submission (mark as reviewed)                            */
  /* ================================================================ */

  const handleReviewSubmission = async (e, sub) => {
    e.stopPropagation();
    try {
      await axiosClient.patch(`/auth/client-submissions/${sub.id}/`, {
        status: 'reviewed',
      });
      showSnackbar('Submission marked as reviewed.');
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to review submission', 'error');
    }
  };

  /* ================================================================ */
  /*  Accept submission (approve directly)                            */
  /* ================================================================ */

  const handleAcceptReview = async (e, sub) => {
    e.stopPropagation();
    setApproveLoading(true);
    try {
      const res = await axiosClient.post(`/auth/client-submissions/${sub.id}/approve/`);
      showSnackbar(res.data.message || 'Submission approved. You can now assign a coordinator.');
      setReviewingId(null);
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to approve submission', 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  /* ================================================================ */
  /*  Cancel project (for rejected submissions)                       */
  /* ================================================================ */

  const handleCancelProject = async (e, sub) => {
    e.stopPropagation();
    setApproveLoading(true);
    try {
      await axiosClient.delete(`/auth/client-submissions/${sub.id}/`);
      showSnackbar('Submission cancelled and removed.');
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to cancel submission', 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  /* ================================================================ */
  /*  Reject submission                                               */
  /* ================================================================ */

  const handleOpenRejectDialog = (e, sub) => {
    e.stopPropagation();
    setRejectSubmission(sub);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectSubmission || !rejectionReason.trim()) return;
    setRejectLoading(true);
    try {
      await axiosClient.patch(`/auth/client-submissions/${rejectSubmission.id}/`, {
        status: 'rejected',
        notes: rejectionReason,
      });
      showSnackbar('Submission rejected.');
      setRejectDialogOpen(false);
      setRejectSubmission(null);
      setRejectionReason('');
      setReviewingId(null);
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to reject submission', 'error');
    } finally {
      setRejectLoading(false);
    }
  };

  /* ================================================================ */
  /*  Pagination                                                       */
  /* ================================================================ */

  const handlePageChange = (_, newPage) => setPage(newPage);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <Box>
      {/* Page Title */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Client Submissions
      </Typography>

      {/* ========================================================== */}
      {/*  Summary Cards                                              */}
      {/* ========================================================== */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={PeopleIcon}
            title="Total Submissions"
            value={summary.total}
            color="#1565C0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={PendingIcon}
            title="Pending"
            value={summary.pending}
            color="#1E88E5"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={CancelIcon}
            title="Rejected"
            value={summary.rejected}
            color="#DC2626"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={CheckCircleIcon}
            title="Approved"
            value={summary.approved}
            color="#1565C0"
          />
        </Grid>
      </Grid>

      {/* ========================================================== */}
      {/*  Search & Status Filter                                     */}
      {/* ========================================================== */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, email, company, or project..."
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
          sx={{ flex: 1, minWidth: 280 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* ========================================================== */}
      {/*  Data Table                                                  */}
      {/* ========================================================== */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 950 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom.tableHeader }}>
              <TableCell sx={{ fontWeight: 700, width: 48 }} />
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Project Title</TableCell>
              <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Coordinator</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700, textAlign: 'center', minWidth: 180 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No submissions found
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((sub) => {
                const isExpanded = expandedId === sub.id;
                const fullName =
                  [sub.first_name, sub.last_name].filter(Boolean).join(' ') || '-';
                const hasCoordinator = !!sub.coordinator_name;

                return (
                  <Fragment key={sub.id}>
                    {/* Main Row */}
                    <TableRow
                      hover
                      onClick={() => handleToggleExpand(sub.id)}
                      sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fullName}
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.company_name || '-'}
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={sub.project_title || '-'}>
                          <span>{sub.project_title || '-'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {(() => {
                          const displayStatus = getDisplayStatus(sub.status);
                          return (
                            <Chip
                              label={
                                displayStatus
                                  ? displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)
                                  : 'Unknown'
                              }
                              size="small"
                              sx={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: STATUS_CHIP_COLORS[displayStatus] || '#90CAF9',
                                bgcolor: `${STATUS_CHIP_COLORS[displayStatus] || '#90CAF9'}15`,
                                border: `1px solid ${STATUS_CHIP_COLORS[displayStatus] || '#90CAF9'}50`,
                                width: 110,
                                justifyContent: 'center',
                              }}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sub.coordinator_name ? (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                              {sub.coordinator_name}
                            </Typography>
                            {sub.coordinator_response && (
                              <Chip
                                label={COORDINATOR_RESPONSE_CONFIG[sub.coordinator_response]?.label || sub.coordinator_response}
                                size="small"
                                sx={{
                                  mt: 0.5,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  height: 20,
                                  bgcolor: COORDINATOR_RESPONSE_CONFIG[sub.coordinator_response]?.bg || '#90CAF915',
                                  color: COORDINATOR_RESPONSE_CONFIG[sub.coordinator_response]?.color || '#90CAF9',
                                  border: `1px solid ${COORDINATOR_RESPONSE_CONFIG[sub.coordinator_response]?.color || '#90CAF9'}50`,
                                }}
                              />
                            )}
                          </Box>
                        ) : sub.coordinator_response === 'rejected' ? (
                          <Chip
                            label="Rejected"
                            size="small"
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: COORDINATOR_RESPONSE_CONFIG.rejected?.bg || 'transparent',
                              color: COORDINATOR_RESPONSE_CONFIG.rejected?.color || '#DC2626',
                              border: `1px solid ${COORDINATOR_RESPONSE_CONFIG.rejected?.color || '#DC2626'}50`,
                            }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {formatDate(sub.submitted_at)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        {(() => {
                          const displayStatus = getDisplayStatus(sub.status);

                          /* ---- Approved: Assign coordinator ---- */
                          if (displayStatus === 'approved') {
                            if (hasCoordinator && sub.coordinator_response === 'rejected') {
                              return (
                                <Tooltip title="Re-assign a new coordinator">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<ReplayIcon />}
                                    onClick={(e) => handleOpenAssignDialog(e, sub)}
                                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', width: 110 }}
                                  >
                                    Re-assign
                                  </Button>
                                </Tooltip>
                              );
                            }
                            // If a coordinator is assigned (regardless of project creation), show 'Assigned' (disabled)
                            if (hasCoordinator) {
                              return (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  disabled
                                  sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, width: 110 }}
                                >
                                  Assigned
                                </Button>
                              );
                            }
                            return (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PersonAddIcon />}
                                disabled={assignLoading}
                                onClick={(e) => handleOpenAssignDialog(e, sub)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, width: 110 }}
                              >
                                Assign
                              </Button>
                            );
                          }

                          /* ---- Rejected: Show Rejected label ---- */
                          if (displayStatus === 'rejected') {
                            return (
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, color: '#DC2626', fontSize: '0.8rem' }}
                              >
                                Rejected
                              </Typography>
                            );
                          }

                          /* ---- Assigned: Show Assigned (disabled) ---- */
                          if (displayStatus === 'assigned') {
                            return (
                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                disabled
                                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, width: 110 }}
                              >
                                Assigned
                              </Button>
                            );
                          }

                          /* ---- Reviewed: Show Accept / Reject ---- */
                          if (displayStatus === 'reviewed') {
                            return (
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<CheckCircleIcon />}
                                  disabled={approveLoading}
                                  onClick={(e) => handleAcceptReview(e, sub)}
                                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<CancelIcon />}
                                  onClick={(e) => handleOpenRejectDialog(e, sub)}
                                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                                >
                                  Reject
                                </Button>
                              </Box>
                            );
                          }

                          /* ---- Coordinator Rejected: Show Re-assign ---- */
                          if (sub.coordinator_response === 'rejected') {
                            return (
                              <Tooltip title="Re-assign a new coordinator">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<ReplayIcon />}
                                  onClick={(e) => handleOpenAssignDialog(e, sub)}
                                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', width: 110 }}
                                >
                                  Re-assign
                                </Button>
                              </Tooltip>
                            );
                          }

                          /* ---- Pending: Show Review button ---- */
                          return (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={(e) => handleReviewSubmission(e, sub)}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', width: 110 }}
                            >
                              Review
                            </Button>
                          );
                        })()}
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Row */}
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, bgcolor: (t) => t.palette.custom.cardInner }}>
                            {/* Rejection Alert */}
                            {sub.coordinator_response === 'rejected' && (
                              <Alert 
                                severity="error" 
                                sx={{ mb: 3 }}
                                action={
                                  <Button
                                    color="inherit"
                                    size="small"
                                    startIcon={<ReplayIcon />}
                                    onClick={(e) => handleOpenAssignDialog(e, sub)}
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Re-assign
                                  </Button>
                                }
                              >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  Coordinator Rejected This Assignment
                                </Typography>
                                <Typography variant="body2">
                                  {sub.rejection_reason || 'No reason provided'}
                                </Typography>
                                {sub.responded_at && (
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                    Rejected on: {formatDate(sub.responded_at)}
                                  </Typography>
                                )}
                              </Alert>
                            )}

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

                              {/* Company & Address */}
                              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Company Details
                                </Typography>
                                <DetailField label="Company" value={sub.company_name} />
                                <DetailField label="Address" value={sub.address} />
                              </Box>

                              {/* Project Information */}
                              <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Details
                                </Typography>
                                <DetailField label="Project Title" value={sub.project_title} />
                                <Box sx={{ mb: 1.5 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      fontWeight: 600,
                                      display: 'block',
                                      mb: 0.5,
                                      textTransform: 'uppercase',
                                      fontSize: '0.65rem',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    Description
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      bgcolor: 'background.paper',
                                      p: 1,
                                      borderRadius: 1,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      maxHeight: 80,
                                      overflow: 'auto',
                                      fontSize: '0.8rem'
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

                            {/* Action Button for rejected */}
                            {sub.coordinator_response === 'rejected' && (
                              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  startIcon={<ReplayIcon />}
                                  onClick={(e) => handleOpenAssignDialog(e, sub)}
                                  sx={{ fontWeight: 600 }}
                                >
                                  Re-assign to New Coordinator
                                </Button>
                              </Box>
                            )}

                            {/* Assignment History */}
                            {sub.assignment_history && sub.assignment_history.length > 0 && (
                              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Assignment History
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  {sub.assignment_history.map((assignment, index) => (
                                    <Box 
                                      key={assignment.id}
                                      sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 2,
                                        p: 1.5,
                                        bgcolor: 'background.paper',
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                      }}
                                    >
                                      <Box sx={{ 
                                        width: 24, 
                                        height: 24, 
                                        borderRadius: '50%', 
                                        bgcolor: 'primary.main', 
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        flexShrink: 0
                                      }}>
                                        {sub.assignment_history.length - index}
                                      </Box>
                                      <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {assignment.coordinator_name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          Assigned: {formatDate(assignment.assigned_at)}
                                          {assignment.assigned_by_name && ` by ${assignment.assigned_by_name}`}
                                        </Typography>
                                        {assignment.status === 'rejected' && assignment.rejection_reason && (
                                          <Box sx={{ mt: 0.5 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main' }}>
                                              Reason for Rejection:
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'error.main', ml: 0.5 }}>
                                              {assignment.rejection_reason}
                                            </Typography>
                                          </Box>
                                        )}
                                      </Box>
                                      <Chip
                                        label={assignment.status_display}
                                        size="small"
                                        sx={{
                                          fontSize: '0.7rem',
                                          fontWeight: 600,
                                          bgcolor:
                                            assignment.status === 'accepted' ? '#1565C015' :
                                            assignment.status === 'rejected' ? '#DC262615' : '#1E88E515',
                                          color:
                                            assignment.status === 'accepted' ? '#1565C0' :
                                            assignment.status === 'rejected' ? '#DC2626' : '#1E88E5',
                                          border: `1px solid ${
                                            assignment.status === 'accepted' ? '#1565C0' :
                                            assignment.status === 'rejected' ? '#DC2626' : '#1E88E5'
                                          }50`,
                                        }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
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

      {/* ========================================================== */}
      {/*  Assign Coordinator Dialog                                   */}
      {/* ========================================================== */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => {
          if (!assignLoading) {
            setAssignDialogOpen(false);
            setSelectedSubmission(null);
            setSelectedCoordinator(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Coordinator</DialogTitle>
        <DialogContent dividers>
          {selectedSubmission && (
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Assign a coordinator to the submission from{' '}
              <strong>
                {[selectedSubmission.first_name, selectedSubmission.last_name]
                  .filter(Boolean)
                  .join(' ')}
              </strong>
            </Typography>
          )}

          {coordinators.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {coordinators.map((coord) => (
                <ListItemButton
                  key={coord.id}
                  selected={selectedCoordinator === coord.id}
                  onClick={() => setSelectedCoordinator(coord.id)}
                  sx={{ borderRadius: 1, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Radio
                      checked={selectedCoordinator === coord.id}
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      coord.name ||
                      coord.full_name ||
                      `${coord.first_name || ''} ${coord.last_name || ''}`.trim() ||
                      coord.username
                    }
                    secondary={`Assigned: ${coord.assigned_count ?? coord.assignment_count ?? 0}`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setAssignDialogOpen(false);
              setSelectedSubmission(null);
              setSelectedCoordinator(null);
            }}
            disabled={assignLoading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignCoordinator}
            disabled={!selectedCoordinator || assignLoading}
            startIcon={
              assignLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PersonAddIcon />
              )
            }
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================== */}
      {/*  Reject Dialog                                              */}
      {/* ========================================================== */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          if (!rejectLoading) {
            setRejectDialogOpen(false);
            setRejectSubmission(null);
            setRejectionReason('');
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Reject Submission</DialogTitle>
        <DialogContent>
          {rejectSubmission && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                You are rejecting the submission from <strong>{[rejectSubmission.first_name, rejectSubmission.last_name].filter(Boolean).join(' ')}</strong> for project <strong>{rejectSubmission.project_title}</strong>.
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Please provide a reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
            error={rejectDialogOpen && !rejectionReason.trim()}
            helperText={rejectDialogOpen && !rejectionReason.trim() ? 'Rejection reason is required' : ''}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setRejectDialogOpen(false);
              setRejectSubmission(null);
              setRejectionReason('');
            }}
            disabled={rejectLoading}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleReject}
            disabled={rejectLoading || !rejectionReason.trim()}
            startIcon={<CancelIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, width: 110 }}
          >
            {rejectLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================== */}
      {/*  Snackbar                                                    */}
      {/* ========================================================== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
