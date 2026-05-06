import { Fragment } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Collapse,
  IconButton,
  Stack,
} from '@mui/material';
import {
  PictureAsPdf,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Person,
  CalendarToday,
  Description,
  Visibility,
} from '@mui/icons-material';
import { viewValuationPDF } from '../utils/generateValuationPDF';
import StatusChip from './StatusChip';
import ReportHistory from './ReportHistory';
import { formatDate, getPriorityColor, capitalize } from '../utils/helpers';
import ProjectDocumentsList from './project-detail/ProjectDocumentsList';

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
        letterSpacing: '0.8px',
      }}
    >
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word', fontSize: '0.95rem' }}>
      {value || '-'}
    </Typography>
  </Box>
);

const DEFAULT_COLUMN_LABELS = {
  title: 'Project Title',
  client: 'Client',
  startDate: 'Start Date',
  dueDate: 'Due Date',
  priority: 'Priority',
  status: 'Status',
  valuations: 'Valuations',
};

const DEFAULT_SECTION_LABELS = {
  projectInfo: 'Project Information',
  timeline: 'Timeline',
  client: 'Client',
  clientName: 'Client Name',
  valuations: 'Valuations',
  documents: 'Project Documents',
};

export default function ProjectValuationReviewTable({
  filteredProjects,
  expandedRow,
  projectValuations,
  onToggleExpand,
  renderValuationActions,
  renderValuationStatusChip,
  showAccessorComments = false,
  columnLabels = {},
  sectionLabels = {},
}) {
  const colCount = 8;
  const resolvedColumnLabels = { ...DEFAULT_COLUMN_LABELS, ...columnLabels };
  const resolvedSectionLabels = { ...DEFAULT_SECTION_LABELS, ...sectionLabels };

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
            <TableCell sx={{ width: 48 }} />
            <TableCell sx={{ fontWeight: 700, width: '18%' }}>{resolvedColumnLabels.title}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '15%' }}>{resolvedColumnLabels.client}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '12%' }}>{resolvedColumnLabels.startDate}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '12%' }}>{resolvedColumnLabels.dueDate}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '12%' }} align="center">{resolvedColumnLabels.priority}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '12%' }} align="center">{resolvedColumnLabels.status}</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '12%' }} align="right">{resolvedColumnLabels.valuations}</TableCell>
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
                  <TableRow
                    hover
                    sx={{
                      '& > *': { borderBottom: '1px solid', borderColor: 'divider' },
                      cursor: 'pointer',
                    }}
                    onClick={() => onToggleExpand(project)}
                  >
                    <TableCell sx={{ width: 48 }}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand(project); }}>
                        {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{project.title}</TableCell>
                    <TableCell>{project.client_name || project.client_info?.name || 'N/A'}</TableCell>
                    <TableCell>{formatDate(project.start_date)}</TableCell>
                    <TableCell>{formatDate(project.end_date || project.due_date)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={capitalize(project.priority) || 'Normal'}
                        size="small"
                        sx={{
                          bgcolor: `${getPriorityColor(project.priority)}20`,
                          color: getPriorityColor(project.priority),
                          fontWeight: 600,
                          fontSize: 12,
                          width: 110,
                          justifyContent: 'center',
                          border: `1px solid ${getPriorityColor(project.priority)}50`,
                        }}
                      />
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

                  <TableRow>
                    <TableCell colSpan={colCount} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 3, px: 3 }}>
                          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto', mb: 3 }}>
                            <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                {resolvedSectionLabels.projectInfo}
                              </Typography>
                              <DetailField label="Description" value={project.description || 'No description'} />
                              <DetailField label="Priority" value={capitalize(project.priority) || 'Normal'} />
                            </Box>
                            <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                {resolvedSectionLabels.timeline}
                              </Typography>
                              <DetailField label="Start Date" value={formatDate(project.start_date)} />
                              <DetailField label="Due Date" value={formatDate(project.end_date || project.due_date)} />
                            </Box>
                            <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                {resolvedSectionLabels.client}
                              </Typography>
                              <DetailField label={resolvedSectionLabels.clientName} value={project.client_name || project.client_info?.name || 'N/A'} />
                              <DetailField label="Status" value={capitalize(project.status?.replace('_', ' ')) || '-'} />
                            </Box>
                          </Box>

                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                            {resolvedSectionLabels.valuations}
                          </Typography>

                          {valuations.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              No valuations submitted for this project yet.
                            </Typography>
                          ) : (
                            <Box
                              sx={{
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
                              }}
                            >
                              {valuations.map((v, index) => (
                                <Box key={v.id} sx={{ mb: 3, position: 'relative', '&:last-child': { mb: 0 } }}>
                                  <Box
                                    sx={{
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
                                    }}
                                  />

                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                      {v.category_display || v.category || 'N/A'}
                                    </Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                      {v.estimated_value ? `Rs. ${parseFloat(v.estimated_value).toLocaleString()}` : ''}
                                    </Typography>
                                  </Box>

                                  {showAccessorComments && v.accessor_comments && (
                                    <Typography variant="body2" color="info.main" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                                      Accessor: {v.accessor_comments}
                                    </Typography>
                                  )}

                                  {v.status === 'rejected' && v.rejection_reason && (
                                    <Typography variant="body2" color="error.main" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                                      Reason: {v.rejection_reason}
                                    </Typography>
                                  )}

                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Person sx={{ fontSize: 14 }} /> {v.field_officer_name || v.field_officer_username || 'N/A'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">•</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <CalendarToday sx={{ fontSize: 14 }} /> {formatDate(v.submitted_at || v.created_at)}
                                    </Typography>
                                  </Box>

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
                                    {renderValuationActions?.(v, project)}
                                    {renderValuationStatusChip?.(v)}
                                  </Stack>

                                  {v.history && v.history.length > 0 && <ReportHistory history={v.history} />}
                                </Box>
                              ))}
                            </Box>
                          )}

                          {project.documents && project.documents.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                {resolvedSectionLabels.documents}
                              </Typography>
                              <ProjectDocumentsList
                                documents={project.documents}
                                compact
                              />
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
  );
}
