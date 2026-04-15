import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { Login, Logout, Timer, TimerOff } from '@mui/icons-material';
import attendanceService from '../../services/attendanceService';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDate, formatDateTime } from '../../utils/helpers';

export default function MyAttendance() {
  const [today, setToday] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [period, setPeriod] = useState('weekly');

  const fetchData = useCallback(async () => {
    try {
      const [todayRes, recordsRes] = await Promise.all([
        attendanceService.getToday().catch(() => ({ data: null })),
        attendanceService.getSummary({ period }),
      ]);
      setToday(todayRes.data?.data || todayRes.data);
      if (period === 'daily') {
        const dailyRecord = recordsRes.data?.data?.attendance;
        setRecords(dailyRecord ? [dailyRecord] : []);
      } else {
        setRecords(recordsRes.data?.data?.daily_data || []);
      }
    } catch (err) {
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action, label) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(`${label} successful!`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || `${label} failed`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const isCheckedIn = today?.check_in && !today?.check_out;
  const isOvertimeActive = today?.overtime_start && !today?.overtime_end;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Attendance</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Today's Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Today - {new Date().toLocaleDateString()}</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <StatusChip status={today?.status || 'absent'} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Check In</Typography>
              <Typography variant="body1" fontWeight={600}>{today?.check_in ? new Date(today.check_in).toLocaleTimeString() : '-'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Check Out</Typography>
              <Typography variant="body1" fontWeight={600}>{today?.check_out ? new Date(today.check_out).toLocaleTimeString() : '-'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary">Working Hours</Typography>
              <Typography variant="body1" fontWeight={600}>{today?.working_hours || '0.00'} hrs</Typography>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {today?.flags?.can_check_in && (
              <Button variant="contained" color="error" startIcon={<Login />} disabled={actionLoading}
                onClick={() => handleAction(attendanceService.markAttendance, 'Check-in')}>
                Check In
              </Button>
            )}
            {today?.flags?.can_leave_early && (
              <Button variant="outlined" color="primary" startIcon={<Logout />} disabled={actionLoading}
                onClick={() => handleAction(attendanceService.leaveEarly, 'Leave early')}>
                Leave Early
              </Button>
            )}
            {today?.flags?.can_checkout && (
              <Button variant="contained" color="primary" startIcon={<Logout />} disabled={actionLoading}
                onClick={() => handleAction(attendanceService.checkout, 'Check-out')}>
                Check Out
              </Button>
            )}
            {today?.flags?.can_start_overtime && (
              <Button variant="outlined" color="primary" startIcon={<Timer />} disabled={actionLoading}
                onClick={() => handleAction(attendanceService.startOvertime, 'Start overtime')}>
                Start Overtime
              </Button>
            )}
            {isOvertimeActive && (
              <Button variant="outlined" color="error" startIcon={<TimerOff />} disabled={actionLoading}
                onClick={() => handleAction(attendanceService.endOvertime, 'End overtime')}>
                End Overtime
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Summary */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Attendance History</Typography>
        <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small">
          <ToggleButton value="daily">Daily</ToggleButton>
          <ToggleButton value="weekly">Weekly</ToggleButton>
          <ToggleButton value="monthly">Monthly</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '18%' }}>Date</TableCell>
              <TableCell sx={{ width: '14%' }}>Status</TableCell>
              <TableCell sx={{ width: '18%' }}>Check In</TableCell>
              <TableCell sx={{ width: '18%' }}>Check Out</TableCell>
              <TableCell sx={{ width: '16%' }}>Hours</TableCell>
              <TableCell sx={{ width: '16%' }}>Overtime</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No records found</TableCell></TableRow>
            ) : (
              records.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell><StatusChip status={r.status} /></TableCell>
                  <TableCell>{r.check_in ? new Date(r.check_in).toLocaleTimeString() : '-'}</TableCell>
                  <TableCell>{r.check_out ? new Date(r.check_out).toLocaleTimeString() : '-'}</TableCell>
                  <TableCell>{r.working_hours || '0.00'}</TableCell>
                  <TableCell>{r.overtime_hours || '0.00'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
