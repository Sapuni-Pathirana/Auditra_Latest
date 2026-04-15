import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Alert, Card, CardContent, Button } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import PendingIcon from '@mui/icons-material/Pending';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import projectService from '../../services/projectService';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function CoordinatorDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) return <LoadingSpinner />;

  const pending = projects.filter(p => p.status === 'pending').length;
  const active = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Coordinator Dashboard</Typography>
        <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => navigate('/dashboard/projects/create')}>
          New Project
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <StatsCard title="Total Projects" value={projects.length} icon={FolderIcon} color="#1565C0"
            onClick={() => navigate('/dashboard/projects')} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard title="Pending" value={pending} icon={PendingIcon} color="#1E88E5"
            onClick={() => navigate('/dashboard/projects', { state: { filter: 'pending' } })} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard title="In Progress" value={active} icon={PlayCircleIcon} color="#1565C0"
            onClick={() => navigate('/dashboard/projects', { state: { filter: 'in_progress' } })} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard title="Completed" value={completed} icon={CheckCircleIcon} color="#1565C0"
            onClick={() => navigate('/dashboard/projects', { state: { filter: 'completed' } })} />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Recent Projects</Typography>
      <Grid container spacing={2}>
        {projects.slice(0, 6).map((p) => (
          <Grid item xs={12} sm={6} md={4} key={p.id}>
            <Card sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', boxShadow: (t) => t.palette.mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)' }, transition: 'all 0.2s ease' }}
              onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>{p.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.description}
                </Typography>
                <Typography variant="caption" sx={{ color: p.status === 'completed' ? '#1565C0' : p.status === 'in_progress' ? '#1565C0' : '#1E88E5', fontWeight: 600, textTransform: 'uppercase' }}>
                  {p.status_display || p.status?.replace(/_/g, ' ')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
