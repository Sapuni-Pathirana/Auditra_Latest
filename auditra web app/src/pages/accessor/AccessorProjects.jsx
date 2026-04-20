import { useState, useEffect, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment, CircularProgress,
  Alert, Snackbar, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Collapse, IconButton, Stack
} from '@mui/material';
import { Search, Visibility, Map, PictureAsPdf, KeyboardArrowDown, KeyboardArrowUp, Person, CalendarToday, Description } from '@mui/icons-material';
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

export default function AccessorProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedRow, setExpandedRow] = useState(null);
  const [projectValuations, setProjectValuations] = useState({});
  const [valuationDetailDialog, setValuationDetailDialog] = useState({ open: false, valuation: null, projectTitle: '' });

  const statusFilters = ['all', 'active', 'completed'];

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

  const handleAcceptValuation = async () => {
    try {
      await valuationService.acceptValuation(acceptDialog.valuationId, { accessor_comments: acceptDialog.comments });
      setSnackbar({ open: true, message: 'Valuation accepted and sent to Senior Valuer', severity: 'success' });
      setAcceptDialog({ open: false, valuationId: null, comments: '' });
      if (expandedRow) refreshValuations(expandedRow);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to accept valuation', severity: 'error' });
    }
  };

  const [acceptDialog, setAcceptDialog] = useState({ open: false, valuationId: null, comments: '' });
  const [rejectDialog, setRejectDialog] = useState({ open: false, valuationId: null, reason: '' });

  const handleRejectValuation = async () => {
    if (!rejectDialog.reason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for rejection', severity: 'warning' });
      return;
    }
    try {
      await valuationService.rejectValuation(rejectDialog.valuationId, { rejection_reason: rejectDialog.reason });
      setSnackbar({ open: true, message: 'Valuation rejected and Field Officer notified', severity: 'info' });
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
                                      {(v.status === 'submitted' || v.status === 'under_review') && (
                                        <>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            onClick={() => setAcceptDialog({ open: true, valuationId: v.id, comments: '' })}
                                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                                          >
                                            Accept
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() => setRejectDialog({ open: true, valuationId: v.id, reason: '' })}
                                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                                          >
                                            Reject
                                          </Button>
                                        </>
                                      )}
                                      {['reviewed', 'approved', 'rejected'].includes(v.status) && (
                                        <Chip
                                          label={(v.status === 'reviewed' || v.status === 'approved') ? 'Accepted' : 'Rejected'}
                                          size="small"
                                          sx={{
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            bgcolor: (v.status === 'reviewed' || v.status === 'approved') ? '#1565C015' : '#0D47A115',
                                            color: (v.status === 'reviewed' || v.status === 'approved') ? '#1565C0' : '#0D47A1',
                                            border: `1px solid ${(v.status === 'reviewed' || v.status === 'approved') ? '#1565C050' : '#0D47A150'}`,
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

      {/* Valuation Detail Dialog */}
      <Dialog
        open={valuationDetailDialog.open}
        onClose={() => setValuationDetailDialog({ open: false, valuation: null, projectTitle: '' })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Valuation Details
          <Chip
            label={valuationDetailDialog.valuation?.status}
            size="small"
            color={getStatusColor(valuationDetailDialog.valuation?.status) || 'default'}
          />
        </DialogTitle>
        <DialogContent dividers>
          {valuationDetailDialog.valuation && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Core Info */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Category</Typography>
                  <Typography variant="body1" fontWeight="medium">{valuationDetailDialog.valuation.category_display}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Estimated Value</Typography>
                  <Typography variant="body1" fontWeight="medium" color="primary.main">
                    {valuationDetailDialog.valuation.estimated_value ? `Rs. ${parseFloat(valuationDetailDialog.valuation.estimated_value).toLocaleString()}` : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Field Officer</Typography>
                  <Typography variant="body1">{valuationDetailDialog.valuation.field_officer_name || valuationDetailDialog.valuation.field_officer_username}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Submitted Date</Typography>
                  <Typography variant="body1">{formatDate(valuationDetailDialog.valuation.submitted_at || valuationDetailDialog.valuation.created_at)}</Typography>
                </Box>
              </Box>

              {/* Category Specific Info */}
              {valuationDetailDialog.valuation.category === 'land' && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Land Details</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box><Typography variant="caption" color="text.secondary">Area</Typography><Typography variant="body2">{valuationDetailDialog.valuation.land_area} sqft</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Type</Typography><Typography variant="body2">{valuationDetailDialog.valuation.land_type}</Typography></Box>
                    {valuationDetailDialog.valuation.land_location && (
                      <Box sx={{ gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary">Location</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{valuationDetailDialog.valuation.land_location}</Typography>
                          {valuationDetailDialog.valuation.land_latitude && valuationDetailDialog.valuation.land_longitude && (
                            <Button
                              size="small"
                              startIcon={<Map />}
                              onClick={() => window.open(`https://www.google.com/maps?q=${valuationDetailDialog.valuation.land_latitude},${valuationDetailDialog.valuation.land_longitude}`, '_blank')}
                              sx={{ ml: 1, textTransform: 'none' }}
                            >
                              View on Maps
                            </Button>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {valuationDetailDialog.valuation.category === 'building' && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Building Details</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box><Typography variant="caption" color="text.secondary">Area</Typography><Typography variant="body2">{valuationDetailDialog.valuation.building_area} sqft</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Type</Typography><Typography variant="body2">{valuationDetailDialog.valuation.building_type}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Floors</Typography><Typography variant="body2">{valuationDetailDialog.valuation.number_of_floors}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Year Built</Typography><Typography variant="body2">{valuationDetailDialog.valuation.year_built}</Typography></Box>
                    {valuationDetailDialog.valuation.building_location && (
                      <Box sx={{ gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary">Location</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{valuationDetailDialog.valuation.building_location}</Typography>
                          {valuationDetailDialog.valuation.building_latitude && valuationDetailDialog.valuation.building_longitude && (
                            <Button
                              size="small"
                              startIcon={<Map />}
                              onClick={() => window.open(`https://www.google.com/maps?q=${valuationDetailDialog.valuation.building_latitude},${valuationDetailDialog.valuation.building_longitude}`, '_blank')}
                              sx={{ ml: 1, textTransform: 'none' }}
                            >
                              View on Maps
                            </Button>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {valuationDetailDialog.valuation.category === 'vehicle' && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Vehicle Details</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box><Typography variant="caption" color="text.secondary">Make/Model</Typography><Typography variant="body2">{valuationDetailDialog.valuation.vehicle_make} {valuationDetailDialog.valuation.vehicle_model}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Year</Typography><Typography variant="body2">{valuationDetailDialog.valuation.vehicle_year}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Registration</Typography><Typography variant="body2">{valuationDetailDialog.valuation.vehicle_registration_number}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Mileage</Typography><Typography variant="body2">{valuationDetailDialog.valuation.vehicle_mileage} km</Typography></Box>
                    {valuationDetailDialog.valuation.vehicle_condition && (
                      <Box sx={{ gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary">Condition</Typography>
                        <Typography variant="body2">{valuationDetailDialog.valuation.vehicle_condition}</Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}

              {/* Photos Section */}
              {valuationDetailDialog.valuation.photos?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Uploaded Photos</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {valuationDetailDialog.valuation.photos.map(photo => (
                      <Box
                        key={photo.id}
                        component="img"
                        src={photo.photo_url || photo.photo}
                        alt={photo.caption || 'Valuation photo'}
                        sx={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Description & Notes */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body2">{valuationDetailDialog.valuation.description || 'No description provided.'}</Typography>
              </Box>

              {valuationDetailDialog.valuation.notes && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{valuationDetailDialog.valuation.notes}</Typography>
                </Box>
              )}

              {/* Rejection Info */}
              {valuationDetailDialog.valuation.status === 'rejected' && valuationDetailDialog.valuation.rejection_reason && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">Rejection Reason:</Typography>
                  {valuationDetailDialog.valuation.rejection_reason}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {valuationDetailDialog.valuation?.status !== 'draft' && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<PictureAsPdf />}
              onClick={() => {
                if (valuationDetailDialog.valuation?.submitted_report_url) {
                  window.open(valuationDetailDialog.valuation.submitted_report_url, '_blank');
                } else {
                  viewValuationPDF(valuationDetailDialog.valuation, valuationDetailDialog.projectTitle);
                }
              }}
            >
              View PDF Report
            </Button>
          )}
          {valuationDetailDialog.valuation?.final_report_url && (
            <Button
              variant="outlined"
              onClick={() => window.open(valuationDetailDialog.valuation.final_report_url, '_blank')}
            >
              View Generated PDF
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button sx={{ width: 110 }} onClick={() => setValuationDetailDialog({ open: false, valuation: null, projectTitle: '' })}>Close</Button>
          {(valuationDetailDialog.valuation?.status === 'submitted' || valuationDetailDialog.valuation?.status === 'under_review') && (
            <>
              <Button
                variant="outlined"
                color="primary"
                sx={{ width: 110 }}
                onClick={() => {
                  setAcceptDialog({ open: true, valuationId: valuationDetailDialog.valuation.id, comments: '' });
                  setValuationDetailDialog({ open: false, valuation: null, projectTitle: '' });
                }}
              >
                Accept
              </Button>
              <Button
                variant="outlined"
                color="error"
                sx={{ width: 110 }}
                onClick={() => {
                  setRejectDialog({ open: true, valuationId: valuationDetailDialog.valuation.id, reason: '' });
                  setValuationDetailDialog({ open: false, valuation: null, projectTitle: '' });
                }}
              >
                Reject
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Accept Comments Dialog */}
      <Dialog open={acceptDialog.open} onClose={() => setAcceptDialog({ ...acceptDialog, open: false })}>
        <DialogTitle>Accept & Submit to Senior Valuer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Add your comments for this valuation. This will be submitted as a draft report to the Senior Valuer.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Comments (optional)"
            value={acceptDialog.comments}
            onChange={(e) => setAcceptDialog({ ...acceptDialog, comments: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAcceptDialog({ ...acceptDialog, open: false })} sx={{ width: 110 }}>Cancel</Button>
          <Button onClick={handleAcceptValuation} color="primary" variant="outlined" sx={{ width: 110 }}>Submit to Senior Valuer</Button>
        </DialogActions>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ ...rejectDialog, open: false })}>
        <DialogTitle>Reject Valuation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this valuation. This will be sent to the field officer.
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
