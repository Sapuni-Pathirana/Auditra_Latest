import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Typography,
} from '@mui/material';
import { AttachFile, Description } from '@mui/icons-material';
import ProjectDocumentsList from './ProjectDocumentsList';

export default function ProjectDocumentsSection({
  project,
  isCoordinator,
  docUploading,
  docFileRef,
  onDocumentFileSelected,
  deletingDocId,
  onDeleteDocument,
}) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachFile color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Project Documents</Typography>
          </Box>
          {isCoordinator && project.status !== 'cancelled' && (
            <Button
              variant="outlined"
              component="label"
              size="small"
              startIcon={<Description />}
              disabled={docUploading}
            >
              {docUploading ? 'Uploading...' : 'Upload Document'}
              <input type="file" hidden ref={docFileRef} onChange={onDocumentFileSelected} />
            </Button>
          )}
        </Box>

        {docUploading && <LinearProgress sx={{ mb: 2 }} />}

        <ProjectDocumentsList
          documents={project.documents || []}
          isCoordinator={isCoordinator}
          deletingDocId={deletingDocId}
          onDeleteDocument={onDeleteDocument}
        />
      </CardContent>
    </Card>
  );
}
