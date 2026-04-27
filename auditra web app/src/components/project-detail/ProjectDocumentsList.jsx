import { Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { Delete, Description, Visibility } from '@mui/icons-material';
import { formatDate, formatFileSize } from '../../utils/helpers';

export default function ProjectDocumentsList({
  documents = [],
  isCoordinator = false,
  deletingDocId = null,
  onDeleteDocument,
  compact = false,
}) {
  if (!documents.length) {
    return (
      <Box sx={{ py: compact ? 1 : 3, textAlign: 'center' }}>
        <Description sx={{ fontSize: compact ? 32 : 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary" variant={compact ? 'body2' : 'body1'}>
          No documents have been attached to this project.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.75 : 1 }}>
      {documents.map((doc) => (
        <Box
          key={doc.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: compact ? 1.5 : 2,
            bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
            borderRadius: compact ? 1 : 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 1 : 1.5, minWidth: 0 }}>
            <Description sx={{ color: 'primary.main', fontSize: compact ? 20 : 24 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {doc._optimistic ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                    <CircularProgress size={10} />
                    Uploading...
                  </Box>
                ) : (
                  <>
                    {formatFileSize(doc.file_size)}{compact ? '' : ` · Uploaded ${formatDate(doc.uploaded_at)}`}
                    {!compact && doc.uploaded_by_username ? ` by ${doc.uploaded_by_username}` : ''}
                  </>
                )}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {doc._optimistic ? (
              <Tooltip title="Uploading...">
                <span>
                  <IconButton size="small" disabled>
                    <Visibility fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title="View">
                <IconButton size="small" href={doc.file_url} target="_blank" component="a">
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isCoordinator && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDeleteDocument?.(doc.id)}
                  disabled={deletingDocId === doc.id || !!doc._optimistic}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
