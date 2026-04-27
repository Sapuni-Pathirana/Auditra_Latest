import { Box, Button, Card, CardContent, Grid, Typography } from '@mui/material';
import { AssignmentInd, Description, Download, EventNote, FactCheck, Timeline as TimelineIcon } from '@mui/icons-material';
import ReportHistory from '../ReportHistory';
import StatusChip from '../StatusChip';
import { formatDate } from '../../utils/helpers';

export default function ProjectTimelineReportsSection({ project }) {
  return (
    <>
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 400 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimelineIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Project Timeline</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Activity history and status updates
              </Typography>

              {project.history && project.history.length > 0 ? (
                <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', left: 8, top: 10, bottom: 10, width: '2px', bgcolor: 'divider' } }}>
                  {project.history.slice().reverse().map((event, index) => (
                    <Box key={event.id} sx={{ mb: 3, position: 'relative' }}>
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
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {event.status_display || event.status}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {event.notes}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AssignmentInd sx={{ fontSize: 14 }} /> {event.created_by_name || event.created_by_username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">•</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EventNote sx={{ fontSize: 14 }} /> {formatDate(event.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No activity has been recorded yet.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 400 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <FactCheck color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Final Valuation Reports</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Approved reports available for download
              </Typography>

              {project.valuations && project.valuations.filter((v) => v.status === 'approved').length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {project.valuations.filter((v) => v.status === 'approved').map((valuation) => (
                    <Box key={valuation.id} sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {valuation.category_display} Report
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Approved by Senior Valuer
                          </Typography>
                        </Box>
                        {valuation.final_report_url && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            href={valuation.final_report_url}
                            target="_blank"
                          >
                            PDF
                          </Button>
                        )}
                      </Box>
                      {valuation.senior_valuer_comments && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary', fontSize: '0.8125rem' }}>
                          "{valuation.senior_valuer_comments}"
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Description sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No approved reports are available at this time.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {project.valuations && project.valuations.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TimelineIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Valuation Report History</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Submission and review history for each valuation report
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {project.valuations.map((v) => (
                <Box key={v.id} sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {v.category_display || v.category || 'Valuation'}
                    </Typography>
                    <StatusChip status={v.status} label={v.status_display || v.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Field Officer: {v.field_officer_name || v.field_officer_username}
                  </Typography>
                  <ReportHistory history={v.history} />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </>
  );
}
