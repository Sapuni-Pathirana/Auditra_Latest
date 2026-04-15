import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, MenuItem, Chip, Alert,
  Button, Snackbar, InputAdornment, IconButton, Tooltip, CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon, Refresh as RefreshIcon, VerifiedUser as VerifiedUserIcon,
  WarningAmber as WarningAmberIcon, KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';

/*
  CATEGORY_OPTIONS values MUST exactly match the backend CATEGORY_CHOICES in
  system_logs/models.py:
    ('auth', 'Authentication'),
    ('user', 'User Management'),
    ('project', 'Projects'),
    ('payment', 'Payments'),
    ('leave', 'Leave Management'),
    ('removal', 'Employee Removal'),
    ('submission', 'Form Submissions'),
    ('attendance', 'Attendance'),
    ('valuation', 'Valuations'),
    ('system', 'System'),
*/
const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'user', label: 'User Management' },
  { value: 'project', label: 'Projects' },
  { value: 'payment', label: 'Payments' },
  { value: 'leave', label: 'Leave Management' },
  { value: 'removal', label: 'Employee Removal' },
  { value: 'submission', label: 'Form Submissions' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'valuation', label: 'Valuations' },
  { value: 'system', label: 'System' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_LOGOUT', label: 'User Logout' },
  { value: 'USER_REGISTER', label: 'User Registration' },
  { value: 'USER_DELETE', label: 'User Deleted' },
  { value: 'ROLE_ASSIGNED', label: 'Role Assigned' },
  { value: 'PASSWORD_CHANGED', label: 'Password Changed' },
  { value: 'PROJECT_CREATED', label: 'Project Created' },
  { value: 'PROJECT_UPDATED', label: 'Project Updated' },
  { value: 'PROJECT_APPROVED', label: 'Project Approved' },
  { value: 'PROJECT_REJECTED', label: 'Project Rejected' },
  { value: 'FIELD_OFFICER_ASSIGNED', label: 'Field Officer Assigned' },
  { value: 'CLIENT_ASSIGNED', label: 'Client Assigned' },
  { value: 'AGENT_ASSIGNED', label: 'Agent Assigned' },
  { value: 'ACCESSOR_ASSIGNED', label: 'Accessor Assigned' },
  { value: 'SENIOR_VALUER_ASSIGNED', label: 'Senior Valuer Assigned' },
  { value: 'PAYMENT_GENERATED', label: 'Payment Slips Generated' },
  { value: 'PAYMENT_UPLOADED', label: 'Payment Slips Published' },
  { value: 'LEAVE_CREATED', label: 'Leave Request Created' },
  { value: 'LEAVE_APPROVED', label: 'Leave Request Approved' },
  { value: 'LEAVE_REJECTED', label: 'Leave Request Rejected' },
  { value: 'REMOVAL_CREATED', label: 'Removal Request Created' },
  { value: 'REMOVAL_APPROVED', label: 'Removal Request Approved' },
  { value: 'REMOVAL_REJECTED', label: 'Removal Request Rejected' },
  { value: 'CLIENT_FORM_SUBMITTED', label: 'Client Form Submitted' },
  { value: 'EMPLOYEE_FORM_SUBMITTED', label: 'Employee Form Submitted' },
  { value: 'COORDINATOR_ASSIGNED', label: 'Coordinator Assigned' },
  { value: 'SUBMISSION_STATUS_UPDATED', label: 'Submission Status Updated' },
  { value: 'EMPLOYEE_CREATED', label: 'Employee Account Created' },
  { value: 'DOCUMENT_UPLOADED', label: 'Document Uploaded' },
  { value: 'CHAIN_VERIFIED', label: 'Chain Integrity Verified' },
  { value: 'ATTENDANCE_CHECK_IN', label: 'Attendance Check In' },
  { value: 'ATTENDANCE_CHECK_OUT', label: 'Attendance Check Out' },
  { value: 'ATTENDANCE_OVERTIME_START', label: 'Overtime Started' },
  { value: 'ATTENDANCE_OVERTIME_END', label: 'Overtime Ended' },
  { value: 'VALUATION_CREATED', label: 'Valuation Created' },
  { value: 'VALUATION_UPDATED', label: 'Valuation Updated' },
  { value: 'VALUATION_SUBMITTED', label: 'Valuation Submitted' },
  { value: 'VALUATION_ACCEPTED', label: 'Valuation Accepted' },
  { value: 'VALUATION_REJECTED', label: 'Valuation Rejected' },
  { value: 'VALUATION_APPROVED', label: 'Valuation Approved' },
];

/* Colour map — keys match backend category values exactly */
const getCategoryColor = (cat) => {
  const colorMap = {
    auth: '#1565C0',
    user: '#1565C0',
    project: '#1565C0',
    payment: '#1565C0',
    leave: '#1E88E5',
    removal: '#DC2626',
    submission: '#1565C0',
    attendance: '#1565C0',
    valuation: '#1E88E5',
    system: '#DC2626',
  };
  return colorMap[cat] || '#64748B';
};

const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

/* Detail label component for the expanded block details */
const DetailLabel = ({ label, value }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, display: 'block', mb: 0.25 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
      {value || '-'}
    </Typography>
  </Box>
);

/* Single expandable log row */
function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const catColor = getCategoryColor(log.category);

  return (
    <Fragment>
      {/* Main row */}
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{ cursor: 'pointer', '& > *': { borderBottom: open ? 'none' : undefined } }}
      >
        <TableCell sx={{ width: 40, px: 1 }}>
          <IconButton size="small">
            {open ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
            #{log.block_index}
          </Typography>
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
          {formatTimestamp(log.timestamp)}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {log.action_display || log.action}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {log.user_full_name || log.user_username || 'System'}
          </Typography>
        </TableCell>
        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Tooltip title={log.description} arrow>
            <Typography variant="body2" noWrap>{log.description}</Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Chip
            label={log.category_display || log.category}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: catColor,
              borderColor: catColor,
            }}
          />
        </TableCell>
        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
          {log.current_hash ? `${log.current_hash.substring(0, 12)}...` : '-'}
        </TableCell>
      </TableRow>

      {/* Expanded details row */}
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, px: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 4, py: 3, bgcolor: 'background.default' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', mb: 2.5 }}>
                Block Details
              </Typography>

              <Box sx={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* Left column — block info */}
                <Box sx={{ flex: '1 1 340px', minWidth: 280 }}>
                  <DetailLabel label="Block Number" value={log.block_index} />
                  <DetailLabel label="Action" value={log.action_display || log.action} />
                  <DetailLabel label="User" value={log.user_full_name || log.user_username || 'System'} />
                  <DetailLabel label="Description" value={log.description} />
                  <DetailLabel label="Category" value={log.category_display || log.category} />
                  <DetailLabel label="Timestamp" value={formatTimestamp(log.timestamp)} />
                  {log.ip_address && <DetailLabel label="IP Address" value={log.ip_address} />}
                </Box>

                {/* Right column — hashes */}
                <Box sx={{ flex: '1 1 400px', minWidth: 320 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.75, color: 'text.secondary' }}>
                    Current Hash
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      mb: 2.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'success.main',
                      bgcolor: 'success.main',
                      backgroundColor: 'rgba(22, 163, 74, 0.06)',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        fontSize: '0.82rem',
                        color: 'success.dark',
                        lineHeight: 1.6,
                      }}
                    >
                      {log.current_hash || '-'}
                    </Typography>
                  </Box>

                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.75, color: 'text.secondary' }}>
                    Previous Hash
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'warning.main',
                      bgcolor: 'warning.main',
                      backgroundColor: 'rgba(217, 119, 6, 0.06)',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        fontSize: '0.82rem',
                        color: 'warning.dark',
                        lineHeight: 1.6,
                      }}
                    >
                      {log.previous_hash || '-'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Verify chain state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: page + 1,
        page_size: rowsPerPage,
      };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (actionFilter) params.action = actionFilter;

      const res = await axiosClient.get('/system-logs/', { params });
      setLogs(res.data.results || []);
      setTotalCount(res.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load system logs');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, categoryFilter, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await axiosClient.get('/system-logs/verify/');
      setVerifyResult(res.data);
      setSnackbarOpen(true);
    } catch (err) {
      setVerifyResult({
        is_valid: false,
        message: err.response?.data?.message || err.response?.data?.error || 'Verification request failed',
      });
      setSnackbarOpen(true);
    } finally {
      setVerifying(false);
    }
  };

  const handlePageChange = (_, newPage) => setPage(newPage);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>System Logs</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          }}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="Category"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 170 }}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Action"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200 }}
        >
          {ACTION_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchLogs}
        >
          Refresh
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={verifying ? <CircularProgress size={16} color="inherit" /> : <VerifiedUserIcon />}
          onClick={handleVerifyChain}
          disabled={verifying}
        >
          Verify Chain
        </Button>

        {verifyResult && (
          <Chip
            icon={verifyResult.is_valid ? <VerifiedUserIcon /> : <WarningAmberIcon />}
            label={verifyResult.is_valid ? `Chain Valid (${verifyResult.total_blocks || totalCount} blocks)` : 'Chain Tampered'}
            color={verifyResult.is_valid ? 'primary' : 'error'}
            variant="outlined"
            size="small"
          />
        )}
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ width: 40 }} />
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Hash</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* Snackbar for verify result */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={verifyResult?.is_valid ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {verifyResult?.is_valid
            ? `Blockchain integrity verified. ${verifyResult.total_blocks || totalCount} blocks validated.`
            : `Chain integrity compromised: ${verifyResult?.message || 'Tampering detected'}`}
        </Alert>
      </Snackbar>
    </Box>
  );
}
