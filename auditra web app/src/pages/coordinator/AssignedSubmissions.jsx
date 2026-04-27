import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Typography, Paper, TablePagination, TextField, Chip,
  Button, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  AddCircle as AddCircleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import TabFilters from '../../components/TabFilters';
import SubmissionReviewTable from '../../components/SubmissionReviewTable';
import clientSubmissionService from '../../services/clientSubmissionService';

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

/*  Component                                                         */
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

  
  /* ----------Fetch submissions ----------*/
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search) params.search = search;
      if (responseFilter) params.coordinator_response = responseFilter;

      const res = await clientSubmissionService.getSubmissions(params);
      setSubmissions(res.data.results || []);
      setTotalCount(res.data.count || 0);
      
      // Get counts from a full fetch for tab badges
      const countRes = await clientSubmissionService.getSubmissions({ page_size: 1000 });
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

  /*Handlers--------------------------------------------------- */
  const handleToggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const handleAccept = async (submission) => {
    setActionLoading(true);
    try {
      await clientSubmissionService.acceptAssignment(submission.id);
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
      await clientSubmissionService.rejectAssignment(selectedSubmission.id, rejectionReason);
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

  /* Render------------------------------------------------------------------ */
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
      <TabFilters
        tab={responseFilter}
        onTabChange={handleTabChange}
        tabs={[
          { key: '', label: 'All', count: summaryCounts.all, colorKey: 'all' },
          { key: 'pending', label: 'Pending', count: pendingCount, colorKey: 'pending' },
          { key: 'accepted', label: 'Accepted', count: acceptedCount, colorKey: 'accepted' },
          { key: 'rejected', label: 'Rejected', count: rejectedCount, colorKey: 'rejected' },
        ]}
        tabsSx={{ mb: 2 }}
      />

      {/* ---- Search Toolbar ---- */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Client Name, Project Title or Company"
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
      <SubmissionReviewTable
        submissions={submissions.map((s) => ({ ...s, _formattedDate: formatDate(s.submitted_at) }))}
        loading={loading}
        expandedId={expandedRow}
        onToggleExpand={handleToggleExpand}
        statusHeader="Response Status"
        projectBeforeCompany
        getRowSx={(sub) => ({
          bgcolor: (sub.coordinator_response || 'pending') === 'pending' ? 'warning.50' : 'inherit',
        })}
        renderClientCell={(sub, fullName) => (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{fullName}</Typography>
            <Typography variant="caption" color="text.secondary">{sub.email}</Typography>
          </>
        )}
        renderStatusCell={(sub) => {
          const responseStatus = sub.coordinator_response || 'pending';
          const responseChip = RESPONSE_CHIP_COLORS[responseStatus] || RESPONSE_CHIP_COLORS.pending;
          return (
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
          );
        }}
        renderActionsCell={(sub) => {
          const responseStatus = sub.coordinator_response || 'pending';
          const canRespond = responseStatus === 'pending';
          const canCreateProject = responseStatus === 'accepted' && !sub.project_created;
          const projectCreated = responseStatus === 'accepted' && sub.project_created;
          const isRejected = responseStatus === 'rejected';

          return (
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
                    sx={{ textTransform: 'none', fontWeight: 600, width: 100 }}
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
                    sx={{ textTransform: 'none', fontWeight: 600, width: 100 }}
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
                  sx={{ textTransform: 'none', fontWeight: 600, width: 100 }}
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
              {isRejected && <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>-</Typography>}
            </Stack>
          );
        }}
        emptySubtitle="Submissions assigned to you will appear here"
      />
      <Paper sx={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

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
