import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Alert, Chip, TextField, InputAdornment, Snackbar, CircularProgress,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import attendanceService from '../services/attendanceService';
import LoadingSpinner from './LoadingSpinner';
import TabFilters from './TabFilters';

const PERIODS = ['daily', 'weekly', 'monthly'];

export default function AttendanceSummaryView({
  title = 'Attendance Summary',
  subtitle = 'View employee attendance across different periods',
  useSnackbarForErrors = false,
}) {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({});
  const [period, setPeriod] = useState('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        let resData;
        try {
          const res = await attendanceService.getHRAttendanceSummary(period);
          resData = res.data;
        } catch {
          const res = await attendanceService.getWeeklySummary();
          resData = res.data;
          if (period !== 'weekly') {
            setPeriod('weekly');
          }
        }

        setRecords(Array.isArray(resData?.data) ? resData.data : []);
        setMeta({
          startDate: resData?.start_date || resData?.week_start,
          endDate: resData?.end_date || resData?.week_end,
          workingDays: resData?.working_days,
        });
      } catch (err) {
        const message = err.response?.data?.error || 'Failed to load attendance summary';
        if (useSnackbarForErrors) {
          setSnackbar({ open: true, message, severity: 'error' });
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, useSnackbarForErrors]);

  const STATUS_COLORS = {
    present: '#1565C0',
    half_day: '#1E88E5',
    absent: '#DC2626',
    leave: '#DC2626',
  };

  const getAttendanceColor = (pct) => {
    if (pct >= 90) return '#1565C0';
    if (pct >= 70) return '#1E88E5';
    return '#DC2626';
  };

  const isDaily = period === 'daily';

  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (r.employee_name || '').toLowerCase().includes(q) ||
      (r.employee_id || r.employee_number || '').toString().toLowerCase().includes(q);
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: subtitle ? 1 : 3 }}>{title}</Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
      )}

      <Paper sx={{ mb: 2 }}>
        <TabFilters
          tab={PERIODS.indexOf(period)}
          onTabChange={(idx) => setPeriod(PERIODS[idx])}
          tabs={[
            { key: 0, value: 0, label: 'Daily', colorKey: 'all' },
            { key: 1, value: 1, label: 'Weekly', colorKey: 'accepted' },
            { key: 2, value: 2, label: 'Monthly', colorKey: 'pending' },
          ]}
          tabsSx={{ borderBottom: 1, borderColor: 'divider' }}
        />
      </Paper>

      {meta.startDate && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {meta.startDate === meta.endDate ? meta.startDate : `${meta.startDate} — ${meta.endDate}`}
          {meta.workingDays != null && ` • ${meta.workingDays} working day${meta.workingDays !== 1 ? 's' : ''}`}
        </Typography>
      )}

      <TextField
        placeholder="Search by employee name or employee ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        useSnackbarForErrors ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <LoadingSpinner />
        )
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '18%' }}>Employee Name</TableCell>
                <TableCell sx={{ width: '12%' }}>Employee ID</TableCell>
                {isDaily ? (
                  <>
                    <TableCell align="center" sx={{ width: '14%' }}>Status</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Check In</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Check Out</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Working Hrs</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Overtime Hrs</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell align="center" sx={{ width: '14%' }}>Present Days</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Absent Days</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Half Days</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Overtime Hrs</TableCell>
                    <TableCell align="center" sx={{ width: '14%' }}>Attendance %</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No records found for this period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((r, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.employee_name || 'N/A'}</TableCell>
                    <TableCell>{r.employee_id || r.employee_number || '-'}</TableCell>
                    {isDaily ? (
                      <>
                        <TableCell align="center">
                          {(() => {
                            const c = STATUS_COLORS[r.status] || '#90CAF9';
                            return (
                              <Chip
                                label={r.status?.replace('_', ' ') || 'N/A'}
                                size="small"
                                sx={{
                                  textTransform: 'capitalize',
                                  bgcolor: `${c}15`,
                                  color: c,
                                  fontWeight: 600,
                                  fontSize: '0.72rem',
                                  border: `1px solid ${c}50`,
                                }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell align="center">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : '-'}</TableCell>
                        <TableCell align="center">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : '-'}</TableCell>
                        <TableCell align="center">{r.working_hours ?? '0.00'}</TableCell>
                        <TableCell align="center">{r.overtime_hours ?? '0.00'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell align="center">{r.present_days ?? 0}</TableCell>
                        <TableCell align="center">{r.absent_days ?? 0}</TableCell>
                        <TableCell align="center">{r.half_days ?? 0}</TableCell>
                        <TableCell align="center">{r.overtime_hours ?? '0.00'}</TableCell>
                        <TableCell align="center">
                          {(() => {
                            const c = getAttendanceColor(parseFloat(r.attendance_percentage ?? 0));
                            return (
                              <Chip
                                label={`${parseFloat(r.attendance_percentage ?? 0).toFixed(1)}%`}
                                size="small"
                                sx={{
                                  bgcolor: `${c}15`,
                                  color: c,
                                  fontWeight: 600,
                                  fontSize: '0.72rem',
                                  border: `1px solid ${c}50`,
                                }}
                              />
                            );
                          })()}
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

      {useSnackbarForErrors && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
        </Snackbar>
      )}
    </Box>
  );
}
