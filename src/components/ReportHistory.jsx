import { Box, Typography, Chip } from '@mui/material';
import { History, CheckCircle, Cancel, Send, Replay } from '@mui/icons-material';

const actionConfig = {
  submitted: { color: '#1565C0', icon: Send, label: 'Submitted' },
  resubmitted: { color: '#E65100', icon: Replay, label: 'Resubmitted' },
  reviewed: { color: '#2E7D32', icon: CheckCircle, label: 'Accepted by Assessor' },
  rejected_by_accessor: { color: '#C62828', icon: Cancel, label: 'Rejected by Assessor' },
  approved_by_sv: { color: '#1565C0', icon: CheckCircle, label: 'Approved by Senior Valuer' },
  rejected_by_sv: { color: '#C62828', icon: Cancel, label: 'Rejected by Senior Valuer' },
  md_approved: { color: '#1B5E20', icon: CheckCircle, label: 'Approved by MD/GM' },
  rejected_by_mdgm: { color: '#B71C1C', icon: Cancel, label: 'Rejected by MD/GM' },
};

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ReportHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
        No history available yet.
      </Typography>
    );
  }

  // Show oldest first
  const sorted = [...history].reverse();

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <History sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.8rem' }}>
          Report History
        </Typography>
      </Box>

      <Box sx={{
        position: 'relative',
        pl: 2.5,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: '2px',
          bgcolor: 'divider',
        },
      }}>
        {sorted.map((entry, index) => {
          const config = actionConfig[entry.action] || { color: '#757575', icon: History, label: entry.action_display || entry.action };
          const Icon = config.icon;
          const isLast = index === sorted.length - 1;

          return (
            <Box key={entry.id} sx={{ mb: isLast ? 0 : 1.5, position: 'relative' }}>
              {/* Dot */}
              <Box sx={{
                position: 'absolute',
                left: -17,
                top: 3,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: config.color,
                border: '2px solid white',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                zIndex: 1,
              }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<Icon sx={{ fontSize: '14px !important' }} />}
                  label={config.label}
                  size="small"
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    height: 22,
                    bgcolor: `${config.color}12`,
                    color: config.color,
                    border: `1px solid ${config.color}30`,
                    '& .MuiChip-icon': { color: config.color },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                  by {entry.performed_by_name}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                  {formatDateTime(entry.created_at)}
                </Typography>
              </Box>

              {entry.comments && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3, pl: 0.5, fontSize: '0.72rem', lineHeight: 1.3 }}>
                  {entry.comments}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
