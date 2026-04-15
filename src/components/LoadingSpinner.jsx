import { Box, CircularProgress, Typography } from '@mui/material';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{message}</Typography>
    </Box>
  );
}
