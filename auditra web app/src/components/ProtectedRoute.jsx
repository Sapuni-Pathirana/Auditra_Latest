import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import { resolveRoleKey } from '../utils/roleConfig';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, passwordChanged, loading } = useAuth();
  const location = useLocation();
  const resolvedRole = resolveRoleKey(role);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force password change for auto-generated passwords
  const isForceChangePage = location.pathname === '/dashboard/force-change-password';
  if (passwordChanged === false && !isForceChangePage) {
    return <Navigate to="/dashboard/force-change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(resolvedRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
