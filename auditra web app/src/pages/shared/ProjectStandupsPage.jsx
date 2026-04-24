import { useParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import ProjectStandups from './ProjectStandups';

export default function ProjectStandupsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          size="small"
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/dashboard/projects/${projectId}`)}
        >
          Back to project
        </Button>
        <Typography variant="h5" fontWeight={700} sx={{ ml: 1 }}>
          Daily Standup
        </Typography>
      </Stack>
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <ProjectStandups projectId={projectId} />
      </Paper>
    </Box>
  );
}
