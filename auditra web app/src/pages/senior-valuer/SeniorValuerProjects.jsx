import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import projectService from '../../services/projectService';
import valuationService from '../../services/valuationService';
import TabFilters from '../../components/TabFilters';
import ProjectValuationReviewTable from '../../components/ProjectValuationReviewTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import { capitalize } from '../../utils/helpers';

export default function SeniorValuerProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedRow, setExpandedRow] = useState(null);
  const [projectValuations, setProjectValuations] = useState({});

  const statusFilters = ['all', 'active', 'completed'];

  const [approveDialog, setApproveDialog] = useState({ open: false, valuationId: null, comments: '' });
  const [rejectDialog, setRejectDialog] = useState({ open: false, valuationId: null, reason: '' });

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await projectService.getProjects();
      setProjects(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load projects', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (project) => {
    const projectId = project.id;
    if (expandedRow === projectId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(projectId);
    if (!projectValuations[projectId]) {
      try {
        const res = await valuationService.getValuations(projectId);
        const vals = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setProjectValuations((prev) => ({ ...prev, [projectId]: vals }));
      } catch {
        setProjectValuations((prev) => ({ ...prev, [projectId]: [] }));
      }
    }
  };

  const refreshValuations = async (projectId) => {
    try {
      const res = await valuationService.getValuations(projectId);
      const vals = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setProjectValuations((prev) => ({ ...prev, [projectId]: vals }));
    } catch {
      // keep existing
    }
  };

  const handleApproveValuation = async () => {
    try {
      await valuationService.approveValuation(approveDialog.valuationId, { senior_valuer_comments: approveDialog.comments });
      setSnackbar({ open: true, message: 'Valuation approved and sent to MD/GM for final approval', severity: 'success' });
      setApproveDialog({ open: false, valuationId: null, comments: '' });
      if (expandedRow) refreshValuations(expandedRow);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to approve valuation', severity: 'error' });
    }
  };

  const handleRejectValuation = async () => {
    if (!rejectDialog.reason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for rejection', severity: 'warning' });
      return;
    }
    try {
      await valuationService.seniorValuerReject(rejectDialog.valuationId, { rejection_reason: rejectDialog.reason });
      setSnackbar({ open: true, message: 'Valuation rejected and sent back', severity: 'info' });
      setRejectDialog({ open: false, valuationId: null, reason: '' });
      if (expandedRow) refreshValuations(expandedRow);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to reject valuation', severity: 'error' });
    }
  };

  const filteredProjects = projects.filter(p => {
    const statusMatch = tabValue === 0 ||
      (statusFilters[tabValue] === 'active' && (p.status === 'in_progress' || p.status === 'pending')) ||
      (p.status === statusFilters[tabValue]);
    const searchMatch = !searchQuery ||
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;

  const renderValuationActions = (v) => (
    v.status === 'reviewed' && (
      <>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<CheckCircle />}
          onClick={() => setApproveDialog({ open: true, valuationId: v.id, comments: '' })}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
        >
          Approve
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<Cancel />}
          onClick={() => setRejectDialog({ open: true, valuationId: v.id, reason: '' })}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
        >
          Reject
        </Button>
      </>
    )
  );

  const renderValuationStatusChip = (v) => {
    if (v.status === 'approved') {
      return (
        <Chip
          label="Approved"
          size="small"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            bgcolor: '#1565C015',
            color: '#1565C0',
            border: '1px solid #1565C050',
          }}
        />
      );
    }

    if (v.status === 'rejected') {
      return (
        <Chip
          label="Rejected"
          size="small"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            bgcolor: '#0D47A115',
            color: '#0D47A1',
            border: '1px solid #0D47A150',
          }}
        />
      );
    }

    return null;
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Projects</Typography>

      <TabFilters
        tab={tabValue}
        onTabChange={setTabValue}
        tabs={[
          { key: 'all', value: 0, label: 'All', count: projects.length, colorKey: 'all' },
          { key: 'in_progress', value: 1, label: 'In Progress', colorKey: 'accepted' },
          { key: 'completed', value: 2, label: 'Completed', colorKey: 'accepted' },
        ]}
        tabsSx={{ borderBottom: 1, borderColor: 'divider' }}
        wrapTabsInPaper
        tabsPaperSx={{ mb: 3 }}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchSx={{ mb: 3 }}
      />

      <ProjectValuationReviewTable
        filteredProjects={filteredProjects}
        expandedRow={expandedRow}
        projectValuations={projectValuations}
        onToggleExpand={handleToggleExpand}
        onStandups={(projectId) => navigate(`/dashboard/projects/${projectId}/standups`)}
        columnLabels={{
          title: 'Project Title',
          client: 'Client',
          startDate: 'Start Date',
          dueDate: 'Due Date',
          priority: 'Priority',
          status: 'Status',
          valuations: 'Valuations',
        }}
        sectionLabels={{
          projectInfo: 'Project Information',
          timeline: 'Timeline',
          client: 'Client',
          clientName: 'Client Name',
          valuations: 'Valuations',
          documents: 'Project Documents',
        }}
        showAccessorComments
        renderValuationActions={renderValuationActions}
        renderValuationStatusChip={renderValuationStatusChip}
      />

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onClose={() => setApproveDialog({ ...approveDialog, open: false })}>
        <DialogTitle>Approve Valuation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to approve this valuation? This will send the report to MD/GM for final approval.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comments (optional)"
            value={approveDialog.comments}
            onChange={(e) => setApproveDialog({ ...approveDialog, comments: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveDialog({ ...approveDialog, open: false })} sx={{ width: 110 }}>Cancel</Button>
          <Button onClick={handleApproveValuation} color="primary" variant="outlined" sx={{ width: 110 }}>Approve & Send to MD/GM</Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ ...rejectDialog, open: false })}>
        <DialogTitle>Reject Valuation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this valuation.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialog({ ...rejectDialog, open: false })} sx={{ width: 110 }}>Cancel</Button>
          <Button onClick={handleRejectValuation} color="error" variant="outlined" sx={{ width: 110 }}>Reject</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
