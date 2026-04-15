import { Box, Typography, Paper, Avatar, useTheme } from '@mui/material';
import { PersonOutline, SupportAgent, Web } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

export default function UnassignedDashboard() {
  const { user } = useAuth();
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Paper sx={{ p: 6, textAlign: 'center', maxWidth: 500, width: '100%' }}>
        <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : 'rgba(21,101,192,0.08)' }}>
          <PersonOutline sx={{ fontSize: 48, color: 'primary.main' }} />
        </Avatar>

        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Welcome, {user?.first_name || user?.username || 'User'}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Your account has been created but you have not been assigned a role yet.
          Please contact your administrator to get your role assigned.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: theme.palette.custom.cardInner }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SupportAgent color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">Need Help?</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            If you believe this is an error, please reach out to your system administrator
            or HR department to have your role assigned. Once assigned, you will have
            access to the features relevant to your position.
          </Typography>
        </Paper>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
          <Web fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            Your profile page is available in the sidebar menu.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
