import { Fragment } from 'react';
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import InfoField from './InfoField';

const DETAIL_LABEL_SX = {
  color: 'text.secondary',
  fontWeight: 600,
  display: 'block',
  mb: 0.5,
  textTransform: 'uppercase',
  fontSize: '0.65rem',
  letterSpacing: '0.8px',
};

const DETAIL_VALUE_SX = {
  fontWeight: 500,
  wordBreak: 'break-word',
  fontSize: '0.95rem',
};

const SubmissionInfoField = ({ label, value }) => (
  <InfoField
    label={label}
    value={value}
    containerSx={{ mb: 2.5 }}
    labelVariant="caption"
    labelSx={DETAIL_LABEL_SX}
    valueVariant="body1"
    valueSx={DETAIL_VALUE_SX}
  />
);

export default function SubmissionReviewTable({
  submissions,
  loading,
  expandedId,
  onToggleExpand,
  statusHeader = 'Status',
  projectBeforeCompany = false,
  rowClickable = false,
  getRowSx,
  renderClientCell,
  renderStatusCell,
  renderCoordinatorCell,
  renderActionsCell,
  renderExpandedTop,
  renderExpandedBottom,
  emptyTitle = 'No submissions found',
  emptySubtitle = 'Submissions will appear here',
  loadingLabel = 'Loading submissions...',
}) {
  const colCount = renderCoordinatorCell ? 8 : 7;

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: (t) => t.palette.custom?.tableHeader || '#F1F5F9' }}>
            <TableCell sx={{ width: 48 }} />
            <TableCell sx={{ fontWeight: 700 }}>{renderCoordinatorCell ? 'Name' : 'Client'}</TableCell>
            {projectBeforeCompany ? (
              <>
                <TableCell sx={{ fontWeight: 700 }}>Project Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
              </>
            ) : (
              <>
                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Project Title</TableCell>
              </>
            )}
            <TableCell sx={{ fontWeight: 700, textAlign: renderCoordinatorCell ? 'center' : undefined }}>
              {statusHeader}
            </TableCell>
            {renderCoordinatorCell && <TableCell sx={{ fontWeight: 700 }}>Coordinator</TableCell>}
            <TableCell sx={{ fontWeight: 700 }}>{renderCoordinatorCell ? 'Date' : 'Submitted'}</TableCell>
            <TableCell sx={{ fontWeight: 700, textAlign: 'center', minWidth: 180 }}>Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colCount} align="center" sx={{ py: 8 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {loadingLabel}
                </Typography>
              </TableCell>
            </TableRow>
          ) : submissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} align="center" sx={{ py: 8 }}>
                <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  {emptyTitle}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {emptySubtitle}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            submissions.map((sub) => {
              const isExpanded = expandedId === sub.id;
              const fullName = [sub.first_name, sub.last_name].filter(Boolean).join(' ') || 'Unknown';

              return (
                <Fragment key={sub.id}>
                  <TableRow
                    hover
                    onClick={rowClickable ? () => onToggleExpand(sub.id) : undefined}
                    sx={{
                      cursor: rowClickable ? 'pointer' : undefined,
                      '& > *': { borderBottom: renderCoordinatorCell ? (isExpanded ? 'unset' : undefined) : '1px solid', borderColor: 'divider' },
                      ...(getRowSx ? getRowSx(sub) : {}),
                    }}
                  >
                    <TableCell sx={{ width: 48 }}>
                      <IconButton size="small" onClick={() => onToggleExpand(sub.id)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{renderClientCell(sub, fullName)}</TableCell>
                    {projectBeforeCompany ? (
                      <>
                        <TableCell>{sub.project_title || '-'}</TableCell>
                        <TableCell>{sub.company_name || '-'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{sub.company_name || '-'}</TableCell>
                        <TableCell>{sub.project_title || '-'}</TableCell>
                      </>
                    )}
                    <TableCell>{renderStatusCell(sub)}</TableCell>
                    {renderCoordinatorCell && <TableCell>{renderCoordinatorCell(sub)}</TableCell>}
                    <TableCell>{sub._formattedDate}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>{renderActionsCell(sub)}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={colCount} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 3, px: 3, bgcolor: renderCoordinatorCell ? (t) => t.palette.custom?.cardInner : undefined }}>
                          {renderExpandedTop?.(sub)}

                          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
                            <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                Client Information
                              </Typography>
                              <SubmissionInfoField label="Full Name" value={fullName} />
                              <SubmissionInfoField label="Email" value={sub.email} />
                              <SubmissionInfoField label="Phone" value={sub.phone} />
                              <SubmissionInfoField label="NIC" value={sub.nic} />
                            </Box>

                            <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                Company Details
                              </Typography>
                              <SubmissionInfoField label="Company" value={sub.company_name} />
                              <SubmissionInfoField label="Address" value={sub.address} />
                            </Box>

                            <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                Project Details
                              </Typography>
                              <SubmissionInfoField label="Project Title" value={sub.project_title} />
                              <Box sx={{ mb: 2 }}>
                                <InfoField
                                  label="Description"
                                  value={sub.project_description}
                                  labelVariant="caption"
                                  labelSx={DETAIL_LABEL_SX}
                                  valueVariant="body1"
                                  valueSx={{
                                    ...DETAIL_VALUE_SX,
                                    bgcolor: 'background.paper',
                                    p: 1.5,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                  }}
                                />
                              </Box>
                            </Box>

                            <Box sx={{ minWidth: 180, flex: '1 1 auto' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 2 }}>
                                Agent Information
                              </Typography>
                              {sub.agent_name || sub.agent_email || sub.agent_phone ? (
                                <>
                                  <SubmissionInfoField label="Agent Name" value={sub.agent_name || 'Not provided'} />
                                  <SubmissionInfoField label="Agent Email" value={sub.agent_email || 'Not provided'} />
                                  <SubmissionInfoField label="Agent Phone" value={sub.agent_phone || 'Not provided'} />
                                </>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  No agent is assigned to this project
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          {renderExpandedBottom?.(sub)}
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
