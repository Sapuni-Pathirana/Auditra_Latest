import { useState, useEffect, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Collapse, IconButton, Stack
} from '@mui/material';
import { Search, PictureAsPdf, KeyboardArrowDown, KeyboardArrowUp, Person, CalendarToday, CheckCircle, Cancel, Description, Visibility } from '@mui/icons-material';
import projectService from '../../services/projectService';
import valuationService from '../../services/valuationService';
import { viewValuationPDF } from '../../utils/generateValuationPDF';
import StatusChip from '../../components/StatusChip';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate, getStatusColor, getPriorityColor, capitalize } from '../../utils/helpers';
import ReportHistory from '../../components/ReportHistory';

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

export default function SeniorValuerProjects() {
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

  const colCount = 8;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Projects</Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`All (${projects.length})`} />
          <Tab label="In Progress" />
          <Tab label="Completed" />
        </Tabs>
      </Paper>

      <TextField
        placeholder="Search projects..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
        }}
      />

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ fontWeight: 700, width: '18%' }}>Project Title</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '15%' }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Start Date</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }}>Due Date</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }} align="center">Priority</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }} align="center">Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '12%' }} align="right">Valuations</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No projects found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => {
                const isExpanded = expandedRow === project.id;
                const valuations = projectValuations[project.id] || [];

                return (
                  <Fragment key={project.id}>
                    {/* Main Project Row */}
                    <TableRow
                      hover
                      sx={{
                        '& > *': { borderBottom: '1px solid', borderColor: 'divider' },
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleExpand(project)}
                    >
                      <TableCell sx={{ width: 48 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleToggleExpand(project); }}>
                          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{project.title}</TableCell>
                      <TableCell>{project.client_name || project.client_info?.name || 'N/A'}</TableCell>
                      <TableCell>{formatDate(project.start_date)}</TableCell>
                      <TableCell>{formatDate(project.end_date || project.due_date)}</TableCell>
                      <TableCell align="center">
                        <Chip label={capitalize(project.priority) || 'Normal'} size="small"
                          sx={{ bgcolor: `${getPriorityColor(project.priority)}20`, color: getPriorityColor(project.priority), fontWeight: 600, fontSize: 12, width: 110, justifyContent: 'center', border: `1px solid ${getPriorityColor(project.priority)}50` }} />
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip status={project.status} label={capitalize(project.status?.replace('_', ' ')) || '-'} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {`${project.valuations_count ?? project.valuations?.length ?? 0} valuation(s)`}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Row */}
                    <TableRow>
                      <TableCell
                        colSpan={colCount}
                        sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 3, px: 3 }}>
                            {/* Project Details Section */}
                            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto', mb: 3 }}>
                              <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Information
                                </Typography>
                                <DetailField label="Description" value={project.description || 'No description'} />
                                <DetailField label="Priority" value={capitalize(project.priority) || 'Normal'} />
                              </Box>
                              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Timeline
                                </Typography>
                                <DetailField label="Start Date" value={formatDate(project.start_date)} />
                                <DetailField label="Due Date" value={formatDate(project.end_date || project.due_date)} />
                              </Box>
                              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Client
                                </Typography>
                                <DetailField label="Client Name" value={project.client_name || project.client_info?.name || 'N/A'} />
                                <DetailField label="Status" value={capitalize(project.status?.replace('_', ' ')) || '-'} />
                              </Box>
                            </Box>

                            {/* Valuations Section */}
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                              Valuations
                            </Typography>

                            {valuations.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No valuations submitted for this project yet.
                              </Typography>
                            ) : (
                              <Box sx={{
                                position: 'relative',
                                pl: 3,
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  left: 8,
                                  top: 10,
                                  bottom: 10,
                                  width: '2px',
                                  bgcolor: 'divider',
                                },
                              }}>
                                {valuations.map((v, index) => (
                                  <Box key={v.id} sx={{ mb: 3, position: 'relative', '&:last-child': { mb: 0 } }}>
                                    {/* Timeline dot */}
                                    <Box sx={{
                                      position: 'absolute',
                                      left: -21,
                                      top: 4,
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: index === 0 ? 'primary.main' : 'divider',
                                      border: '2px solid white',
                                      boxShadow: '0 0 0 2px rgba(0,0,0,0.05)',
                                      zIndex: 1,
                                    }} />

                                    {/* Title row: category + value */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                        {v.category_display || v.category || 'N/A'}
                                      </Typography>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                        {v.estimated_value ? `Rs. ${parseFloat(v.estimated_value).toLocaleString()}` : ''}
                                      </Typography>
                                    </Box>

                                    {/* Accessor comments */}
                                    {v.accessor_comments && (
                                      <Typography variant="body2" color="info.main" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                                        Accessor: {v.accessor_comments}
                                      </Typography>
                                    )}

                                    {/* Rejection reason */}
                                    {v.status === 'rejected' && v.rejection_reason && (
                                      <Typography variant="body2" color="error.main" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                                        Reason: {v.rejection_reason}
                                      </Typography>
                                    )}

                                    {/* Metadata row: field officer + date */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Person sx={{ fontSize: 14 }} /> {v.field_officer_name || v.field_officer_username || 'N/A'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">•</Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CalendarToday sx={{ fontSize: 14 }} /> {formatDate(v.submitted_at || v.created_at)}
                                      </Typography>
                                    </Box>

                                    {/* Action buttons */}
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                      <Button
                                        size="small"
                                        startIcon={<PictureAsPdf />}
                                        onClick={() => {
                                          if (v.submitted_report_url) {
                                            window.open(v.submitted_report_url, '_blank');
                                          } else {
                                            viewValuationPDF(v, project.title);
                                          }
                                        }}
                                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                                      >
                                        View PDF
                                      </Button>
                                      {v.status === 'reviewed' && (
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
                                      )}
                                      {v.status === 'approved' && (
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
                                      )}
                                      {v.status === 'rejected' && (
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
                                      )}
                                    </Stack>

                                    {/* Report History */}
                                    {v.history && v.history.length > 0 && (
                                      <ReportHistory history={v.history} />
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            )}

                            {/* Project Documents */}
                            {project.documents && project.documents.length > 0 && (
                              <Box sx={{ mt: 3 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                  Project Documents
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {project.documents.map((doc) => (
                                    <Box
                                      key={doc.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        p: 1.5,
                                        bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Description sx={{ color: 'primary.main', fontSize: 20 }} />
                                        <Box>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.name}</Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {doc.file_size ? (doc.file_size < 1024 * 1024 ? `${(doc.file_size / 1024).toFixed(1)} KB` : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`) : ''}
                                          </Typography>
                                        </Box>
                                      </Box>
                                      <Button
                                        size="small"
                                        startIcon={<Visibility />}
                                        href={doc.file_url}
                                        target="_blank"
                                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                                      >
                                        View
                                      </Button>
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
      </TableContainer>

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
