import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Tab, Chip, CircularProgress, Alert, Snackbar
} from '@mui/material';
import attendanceService from '../../services/attendanceService';

const PERIODS = ['daily', 'weekly', 'monthly'];

export default function AttendanceView() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({});
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await attendanceService.getHRAttendanceSummary(period);
        const resData = res.data;
        setData(Array.isArray(resData?.data) ? resData.data : []);
        setMeta({
          period: resData?.period,
          startDate: resData?.start_date,
          endDate: resData?.end_date,
          workingDays: resData?.working_days,
        });
      } catch {
        setSnackbar({ open: true, message: 'Failed to load attendance summary', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [period]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'success';
      case 'half_day': return 'warning';
      case 'absent': case 'leave': return 'error';
      default: return 'default';
    }
  };

  const getAttendanceColor = (pct) => {
    if (pct >= 90) return 'success';
    if (pct >= 70) return 'warning';
    return 'error';
  };

  const isDaily = period === 'daily';

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Attendance Summary</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View employee attendance summaries across different periods
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={PERIODS.indexOf(period)}
          onChange={(_, idx) => setPeriod(PERIODS[idx])}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Daily" />
          <Tab label="Weekly" />
          <Tab label="Monthly" />
        </Tabs>
      </Paper>

      {meta.startDate && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {meta.startDate === meta.endDate
            ? meta.startDate
            : `${meta.startDate} — ${meta.endDate}`}
          {meta.workingDays != null && ` • ${meta.workingDays} working day${meta.workingDays !== 1 ? 's' : ''}`}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Employee ID</TableCell>
                {isDaily ? (
                  <>
                    <TableCell>Status</TableCell>
                    <TableCell>Check In</TableCell>
                    <TableCell>Check Out</TableCell>
                    <TableCell>Working Hrs</TableCell>
                    <TableCell>Overtime Hrs</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>Present</TableCell>
                    <TableCell>Absent</TableCell>
                    <TableCell>Half Days</TableCell>
                    <TableCell>Overtime Hrs</TableCell>
                    <TableCell>Attendance %</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isDaily ? 7 : 7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No records found for this period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{row.employee_name || 'N/A'}</TableCell>
                    <TableCell>{row.employee_id || '-'}</TableCell>
                    {isDaily ? (
                      <>
                        <TableCell>
                          <Chip
                            label={row.status?.replace('_', ' ') || 'N/A'}
                            color={getStatusColor(row.status)}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>{row.check_in || '-'}</TableCell>
                        <TableCell>{row.check_out || '-'}</TableCell>
                        <TableCell>{row.working_hours ?? '0.00'}</TableCell>
                        <TableCell>{row.overtime_hours ?? '0.00'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row.present_days ?? 0}</TableCell>
                        <TableCell>{row.absent_days ?? 0}</TableCell>
                        <TableCell>{row.half_days ?? 0}</TableCell>
                        <TableCell>{row.overtime_hours ?? '0.00'}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${parseFloat(row.attendance_percentage ?? 0).toFixed(1)}%`}
                            color={getAttendanceColor(parseFloat(row.attendance_percentage ?? 0))}
                            size="small"
                          />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
