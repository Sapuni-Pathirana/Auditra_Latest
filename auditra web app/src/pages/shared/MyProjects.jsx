import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Alert, TextField, InputAdornment, Tabs, Tab,
} from '@mui/material';
import { Search, Folder, AttachFile } from '@mui/icons-material';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import TabFilters from '../../components/TabFilters';
import { formatDate, getPriorityColor, capitalize } from '../../utils/helpers';

const STATUS_TAB_MAP = { pending: 1, in_progress: 2, completed: 3 };

export default function MyProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(STATUS_TAB_MAP[location.state?.filter] || 0);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects();
        setProjects(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch (err) {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const statuses = ['', 'pending', 'in_progress', 'completed'];
  const filtered = projects
    .filter(p => !statuses[tab] || p.status === statuses[tab])
    .filter(p =>
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Projects</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TabFilters
        tab={tab}
        onTabChange={setTab}
        tabs={[
          { key: 'all', value: 0, label: 'All', count: projects.length, colorKey: 'all' },
          { key: 'pending', value: 1, label: 'Pending', count: projects.filter(p => p.status === 'pending').length, colorKey: 'pending' },
          { key: 'in_progress', value: 2, label: 'In Progress', count: projects.filter(p => p.status === 'in_progress').length, colorKey: 'accepted' },
          { key: 'completed', value: 3, label: 'Completed', count: projects.filter(p => p.status === 'completed').length, colorKey: 'accepted' },
        ]}
        tabsSx={{ mb: 2 }}
        search={search}
        onSearchChange={setSearch}
        searchSx={{ mb: 3 }}
        searchSize="small"
      />

      {filtered.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary" align="center">No projects found</Typography></CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Card sx={{ height: '100%', cursor: 'pointer', '&:hover': { boxShadow: (t) => t.palette.mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)' }, transition: '0.2s' }} onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Folder color="primary" />
                    <Chip label={capitalize(p.priority)} size="small" sx={{ bgcolor: `${getPriorityColor(p.priority)}20`, color: getPriorityColor(p.priority), fontWeight: 600, fontSize: 11, width: 110, justifyContent: 'center', border: `1px solid ${getPriorityColor(p.priority)}50` }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>{p.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusChip status={p.status} label={p.status_display || p.status} />
                    <Typography variant="caption" color="text.secondary">{formatDate(p.start_date)}</Typography>
                  </Box>
                  {(p.documents_count > 0 || (p.documents && p.documents.length > 0)) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                      <AttachFile sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {p.documents_count || p.documents?.length || 0} document(s) attached
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
