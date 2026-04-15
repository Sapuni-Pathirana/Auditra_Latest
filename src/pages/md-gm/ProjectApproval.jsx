import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment, CircularProgress,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Divider
} from '@mui/material';
import { Search, CheckCircle, Cancel, Visibility } from '@mui/icons-material';
import projectService from '../../services/projectService';
import { formatDate, getStatusColor, capitalize } from '../../utils/helpers';

const STATUS_TAB_MAP = { pending: 1, approved: 2, rejected: 3 };

export default function ProjectApproval() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [tabValue, setTabValue] = useState(STATUS_TAB_MAP[location.state?.filter] || 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detailDialog, setDetailDialog] = useState({ open: false, project: null });
  const [remarks, setRemarks] = useState('');

  const statusFilters = ['all', 'pending', 'approved', 'rejected'];

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

  const handleAction = async (id, status) => {
    try {
      await projectService.updateProject(id, { status, remarks });
      setSnackbar({ open: true, message: `Project ${status} successfully`, severity: 'success' });
      setRemarks('');
      setDetailDialog({ open: false, project: null });
      fetchProjects();
    } catch (err) {
      setSnackbar({ open: true, message: `Failed to ${status} project`, severity: 'error' });
    }
  };

  const filteredProjects = projects.filter(p => {
    const statusMatch = tabValue === 0 || p.status === statusFilters[tabValue] ||
      (statusFilters[tabValue] === 'approved' && p.status === 'active');
    const searchMatch = !searchQuery ||
      (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Project Approval</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review and approve or reject project proposals
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`All (${projects.length})`} />
          <Tab label={`Pending (${projects.filter(p => p.status === 'pending').length})`} />
          <Tab label={`Approved (${projects.filter(p => p.status === 'approved' || p.status === 'active').length})`} />
          <Tab label={`Rejected (${projects.filter(p => p.status === 'rejected').length})`} />
        </Tabs>
      </Paper>

      <TextField
        placeholder="Search by project title or client..."
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
              <TableCell>Project Title</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No projects found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => (
                <TableRow key={project.id} hover>
                  <TableCell>{project.title}</TableCell>
                  <TableCell>{project.client_name || project.client_info?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={capitalize(project.priority) || 'Normal'} size="small"
                      color={project.priority === 'high' ? 'primary' : project.priority === 'medium' ? 'warning' : 'default'}
                      sx={{ width: 110, justifyContent: 'center' }} />
                  </TableCell>
                  <TableCell>{formatDate(project.start_date)}</TableCell>
                  <TableCell>{formatDate(project.end_date || project.due_date)}</TableCell>
                  <TableCell>
                    <Chip label={project.status} size="small" color={getStatusColor(project.status) || 'default'} sx={{ width: 110, justifyContent: 'center' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<Visibility />} sx={{ width: 110 }}
                      onClick={() => { setDetailDialog({ open: true, project }); setRemarks(''); }}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={detailDialog.open} onClose={() => setDetailDialog({ open: false, project: null })} maxWidth="md" fullWidth>
        <DialogTitle>Project Review</DialogTitle>
        <DialogContent dividers>
          {detailDialog.project && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Project Title</Typography>
                <Typography variant="h6">{detailDialog.project.title}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography>{detailDialog.project.description || 'No description provided'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Client</Typography>
                  <Typography>{detailDialog.project.client_name || detailDialog.project.client_info?.name || 'N/A'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                  <Typography>{capitalize(detailDialog.project.priority) || 'Normal'}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Start Date</Typography>
                  <Typography>{formatDate(detailDialog.project.start_date)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">Due Date</Typography>
                  <Typography>{formatDate(detailDialog.project.end_date || detailDialog.project.due_date)}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Current Status</Typography>
                <Chip label={detailDialog.project.status} size="small" color={getStatusColor(detailDialog.project.status) || 'default'} sx={{ width: 110, justifyContent: 'center' }} />
              </Box>

              {detailDialog.project.status === 'pending' && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <TextField
                    label="Remarks (optional)"
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
        <DialogActions>
          {detailDialog.project?.status === 'pending' && (
            <>
              <Button color="error" startIcon={<Cancel />} sx={{ width: 110 }}
                onClick={() => handleAction(detailDialog.project.id, 'rejected')}>
                Reject
              </Button>
              <Button color="primary" variant="outlined" startIcon={<CheckCircle />} sx={{ width: 110 }}
                onClick={() => handleAction(detailDialog.project.id, 'approved')}>
                Approve
              </Button>
            </>
          )}
          <Button sx={{ width: 110 }} onClick={() => setDetailDialog({ open: false, project: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
