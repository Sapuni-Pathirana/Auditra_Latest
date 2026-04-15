import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Alert, Card, CardContent, useTheme } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import WarningIcon from '@mui/icons-material/Warning';
import BarChartIcon from '@mui/icons-material/BarChart';
import authService from '../../services/authService';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

const CHART_COLORS = {
  completed: '#90CAF9',
  in_progress: '#1565C0',
  pending: '#0D47A1',
  high: '#0D47A1',
  medium: '#1565C0',
  low: '#90CAF9',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark'; // used by charts

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await authService.getAdminDashboardStats();
        setStats(res.data);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner />;

  const statusData = stats ? [
    { name: 'Completed', value: stats.project_status_distribution.completed, color: CHART_COLORS.completed },
    { name: 'In progress', value: stats.project_status_distribution.in_progress, color: CHART_COLORS.in_progress },
    { name: 'Pending', value: stats.project_status_distribution.pending, color: CHART_COLORS.pending },
  ] : [];

  const priorityData = stats ? [
    { name: 'High', value: stats.priority_distribution.high, color: CHART_COLORS.high },
    { name: 'Low', value: stats.priority_distribution.low, color: CHART_COLORS.low },
    { name: 'Medium', value: stats.priority_distribution.medium, color: CHART_COLORS.medium },
  ] : [];

  const barData = stats?.new_projects_per_month || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Admin Dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {stats && (
        <>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <StatsCard
                title="Total Users"
                value={stats.total_users}
                icon={PeopleIcon}
                color="#1565C0"
                onClick={() => navigate('/dashboard/users')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatsCard
                title="Active Projects"
                value={stats.active_projects}
                icon={BusinessIcon}
                color="#1565C0"
                onClick={() => navigate('/dashboard/projects')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatsCard
                title="Removal Requests"
                value={stats.removal_requests}
                icon={WarningIcon}
                color={stats.removal_requests > 0 ? '#C62828' : '#1565C0'}
                subtitle="Needs Approval"
                onClick={() => navigate('/dashboard/removal-requests')}
              />
            </Grid>
          </Grid>

          {/* Visual Analytics */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BarChartIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Visual Analytics</Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Project Status Distribution - Donut */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${theme.palette.divider}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Project Status Distribution</Typography>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                    {statusData.map((entry) => (
                      <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
                        <Typography variant="caption" sx={{ color: entry.color, fontWeight: 600 }}>
                          {entry.name}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* New Projects Bar Chart */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${theme.palette.divider}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>New Projects (Last 6 Months)</Typography>
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#eee'} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke={isDark ? '#999' : '#666'} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke={isDark ? '#999' : '#666'} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#1565C0" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Priority Overview - Pie */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', border: `1px solid ${theme.palette.divider}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Priority Overview</Typography>
                  <Box sx={{ height: 250, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={priorityData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {priorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                    {priorityData.map((entry) => (
                      <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
                        <Typography variant="caption" sx={{ color: entry.color, fontWeight: 600 }}>
                          {entry.name}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
