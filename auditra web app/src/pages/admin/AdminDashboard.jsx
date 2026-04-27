import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Alert, Card, CardContent, useTheme } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import WarningIcon from '@mui/icons-material/Warning';
import BarChartIcon from '@mui/icons-material/BarChart';
import authService from '../../services/authService';
import axiosClient from '../../api/axiosClient';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import TabFilters from '../../components/TabFilters';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ComposedChart,
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
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodTab, setPeriodTab] = useState(0);
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, kpisRes] = await Promise.allSettled([
          authService.getAdminDashboardStats(),
          axiosClient.get('/auth/admin-kpis/'),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (kpisRes.status === 'fulfilled') setKpis(kpisRes.value.data);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
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

          {/* NEW KPIs */}
          {kpis && (
            <>
              {/* New Clients Over Time */}
              {kpis.new_clients_by_month?.length > 0 && (
                <Card sx={{ mt: 3, border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>New Clients by Month</Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={kpis.new_clients_by_month}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#1565C0" strokeWidth={2} dot={false} name="New Clients" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* C3: On-Time Delivery by Employee / Month — stacked bar */}
              {kpis.on_time_delivery_summary && Object.keys(kpis.on_time_delivery_summary).length > 0 && (
                <Card sx={{ mt: 3, border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>On-Time Delivery by Employee / Month</Typography>
                    {(() => {
                      const rows = [];
                      Object.entries(kpis.on_time_delivery_summary).forEach(([month, employees]) => {
                        Object.entries(employees).forEach(([emp, v]) => {
                          rows.push({ month, employee: emp, on_time: v.on_time, late: v.late, total: v.total });
                        });
                      });
                      if (!rows.length) return <Typography color="text.secondary" align="center">No data</Typography>;
                      return (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="employee" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="on_time" stackId="a" fill="#2e7d32" name="On-Time" />
                            <Bar dataKey="late" stackId="a" fill="#c62828" name="Late" />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* C3: Average Jobs per Employee — horizontal bar */}
              {kpis.avg_jobs_per_employee?.length > 0 && (
                <Card sx={{ mt: 3, border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>Average Jobs per Employee</Typography>
                    <ResponsiveContainer width="100%" height={Math.max(200, kpis.avg_jobs_per_employee.length * 42)}>
                      <BarChart data={kpis.avg_jobs_per_employee} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="employee_name" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip formatter={(val, name) => {
                          if (name === 'Avg days/job') return val !== null ? `${val} days` : 'N/A';
                          return val;
                        }} />
                        <Legend />
                        <Bar dataKey="completed_count" fill="#1565C0" name="Completed Jobs" barSize={18} />
                        <Bar dataKey="avg_days_per_job" fill="#ed6c02" name="Avg days/job" barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Project Status by Period */}
              <Card sx={{ mt: 3, border: `1px solid ${theme.palette.divider}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Project Status by Period</Typography>
                    <TabFilters
                      tab={periodTab}
                      onTabChange={setPeriodTab}
                      tabs={[
                        { key: 0, value: 0, label: 'Monthly', colorKey: 'all' },
                        { key: 1, value: 1, label: 'Quarterly', colorKey: 'accepted' },
                        { key: 2, value: 2, label: 'Yearly', colorKey: 'pending' },
                      ]}
                      tabsSx={{ minHeight: 32 }}
                    />
                  </Box>
                  {(() => {
                    const src = [kpis.project_status_by_month, kpis.project_status_by_quarter, kpis.project_status_by_year][periodTab] || [];
                    // Aggregate into {period, ...statuses}
                    const map = {};
                    src.forEach(({ period, status, count }) => {
                      const key = period ? new Date(period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '?';
                      if (!map[key]) map[key] = { period: key };
                      map[key][status] = (map[key][status] || 0) + count;
                    });
                    const chartData = Object.values(map);
                    if (!chartData.length) return <Typography color="text.secondary" align="center">No data</Typography>;
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="completed" fill="#2e7d32" stackId="a" name="Completed" />
                          <Bar dataKey="in_progress" fill="#1565C0" stackId="a" name="In Progress" />
                          <Bar dataKey="pending" fill="#ed6c02" stackId="a" name="Pending" />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </Box>
  );
}
