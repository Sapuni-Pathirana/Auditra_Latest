import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Alert, Button, Card, CardContent, CardActions,
} from '@mui/material';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PaymentIcon from '@mui/icons-material/Payment';
import leaveService from '../../services/leaveService';
import attendanceService from '../../services/attendanceService';
import paymentService from '../../services/paymentService';
import removalService from '../../services/removalService';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function HRDashboard() {
  const [stats, setStats] = useState({ pendingLeaves: 0, attendance: 0, payments: 0, pendingRemovals: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leavesRes, attRes, paymentsRes, removalRes] = await Promise.all([
          leaveService.getAllRequests().catch(() => ({ data: { data: [] } })),
          attendanceService.getHRAttendanceSummary('daily').catch(() => ({ data: { data: [] } })),
          paymentService.getAllSlips().catch(() => ({ data: { data: [] } })),
          removalService.getAllRequests().catch(() => ({ data: [] })),
        ]);

        const leaves = Array.isArray(leavesRes.data?.data)
          ? leavesRes.data.data
          : (Array.isArray(leavesRes.data) ? leavesRes.data : []);
        const attendance = Array.isArray(attRes.data?.data)
          ? attRes.data.data
          : (Array.isArray(attRes.data) ? attRes.data : []);
        const payments = Array.isArray(paymentsRes.data?.data)
          ? paymentsRes.data.data
          : (Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        const removals = Array.isArray(removalRes.data?.results)
          ? removalRes.data.results
          : (Array.isArray(removalRes.data) ? removalRes.data : []);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        setStats({
          pendingLeaves: leaves.filter(l => l.status === 'pending').length,
          attendance: attendance.filter(a => a.status === 'present').length,
          payments: payments.filter(p => Number(p.month) === currentMonth && Number(p.year) === currentYear).length,
          pendingRemovals: removals.filter(r => r.status === 'pending').length,
        });
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>HR Head Dashboard</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <StatsCard
            title="Pending Leave Requests"
            value={stats.pendingLeaves}
            icon={BeachAccessIcon}
            color="#1E88E5"
            onClick={() => navigate('/dashboard/leave-management')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard
            title="Payment Slips"
            value={stats.payments}
            icon={PaymentIcon}
            color="#1565C0"
            onClick={() => navigate('/dashboard/payments')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard
            title="Daily Attendance"
            value={stats.attendance}
            icon={EventNoteIcon}
            color="#2563EB"
            onClick={() => navigate('/dashboard/attendance-summary')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatsCard
            title="Pending Removals"
            value={stats.pendingRemovals}
            icon={PersonRemoveIcon}
            color="#1E88E5"
            onClick={() => navigate('/dashboard/request-removal')}
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Quick Actions</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Card sx={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(0,0,0,0.12)',
            },
          }} onClick={() => navigate('/dashboard/leave-management')}>
            <CardContent>
              <BeachAccessIcon sx={{ fontSize: 40, mb: 1, color: '#1565C0' }} />
              <Typography variant="subtitle1" fontWeight={600}>Leave Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Approve or reject employee leave requests
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">Open</Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(0,0,0,0.12)',
            },
          }} onClick={() => navigate('/dashboard/payments')}>
            <CardContent>
              <PaymentIcon sx={{ fontSize: 40, mb: 1, color: '#1E88E5' }} />
              <Typography variant="subtitle1" fontWeight={600}>Payments</Typography>
              <Typography variant="body2" color="text.secondary">
                Generate and manage employee payment slips
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">Open</Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(0,0,0,0.12)',
            },
          }} onClick={() => navigate('/dashboard/attendance-summary')}>
            <CardContent>
              <EventNoteIcon sx={{ fontSize: 40, mb: 1, color: '#2563EB' }} />
              <Typography variant="subtitle1" fontWeight={600}>Attendance Summary</Typography>
              <Typography variant="body2" color="text.secondary">
                View weekly attendance records for all employees
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">Open</Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (t) => t.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(0,0,0,0.12)',
            },
          }} onClick={() => navigate('/dashboard/request-removal')}>
            <CardContent>
              <PersonRemoveIcon sx={{ fontSize: 40, mb: 1, color: '#1565C0' }} />
              <Typography variant="subtitle1" fontWeight={600}>Request Removal</Typography>
              <Typography variant="body2" color="text.secondary">
                Submit employee removal requests for admin approval
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small">Open</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
