import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Alert } from '@mui/material';
import { Assignment, PendingActions, CheckCircle, Assessment, Description } from '@mui/icons-material';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import projectService from '../../services/projectService';
import valuationService from '../../services/valuationService';

export default function FieldOfficerDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, inProgress: 0 });
  const [valuationStats, setValuationStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projRes, valRes] = await Promise.all([
          projectService.getProjects(),
          valuationService.getValuations(),
        ]);
        const projects = Array.isArray(projRes.data) ? projRes.data : projRes.data?.results || [];
        const valuations = Array.isArray(valRes.data) ? valRes.data : valRes.data?.results || [];
        setStats({
          total: projects.length,
          pending: projects.filter(p => p.status === 'pending').length,
          completed: projects.filter(p => p.status === 'completed').length,
          inProgress: projects.filter(p => p.status === 'active' || p.status === 'in_progress').length,
        });
        setValuationStats({
          total: valuations.length,
          pending: valuations.filter(v => v.status === 'submitted' || v.status === 'under_review' || v.status === 'pending').length,
          accepted: valuations.filter(v => v.status === 'reviewed' || v.status === 'approved').length,
          rejected: valuations.filter(v => v.status === 'rejected').length,
        });
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Field Officer Dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary' }}>Projects</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Total Projects" value={stats.total} icon={Assignment} color="#1565C0"
            onClick={() => navigate('/dashboard/my-projects')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="In Progress" value={stats.inProgress} icon={PendingActions} color="#1E88E5"
            onClick={() => navigate('/dashboard/my-projects', { state: { filter: 'in_progress' } })} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Completed" value={stats.completed} icon={CheckCircle} color="#1565C0"
            onClick={() => navigate('/dashboard/my-projects', { state: { filter: 'completed' } })} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Pending" value={stats.pending} icon={Assessment} color="#1E88E5"
            onClick={() => navigate('/dashboard/my-projects', { state: { filter: 'pending' } })} />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 4, mb: 2, color: 'text.secondary' }}>Valuations</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Total Valuations" value={valuationStats.total} icon={Description} color="#1565C0"
            onClick={() => navigate('/dashboard/my-projects')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Pending" value={valuationStats.pending} icon={PendingActions} color="#1E88E5"
            onClick={() => navigate('/dashboard/my-projects')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Accepted" value={valuationStats.accepted} icon={CheckCircle} color="#1565C0"
            onClick={() => navigate('/dashboard/my-projects')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Rejected" value={valuationStats.rejected} icon={Assessment} color="#0D47A1"
            onClick={() => navigate('/dashboard/my-projects')} />
        </Grid>
      </Grid>
    </Box>
  );
}
