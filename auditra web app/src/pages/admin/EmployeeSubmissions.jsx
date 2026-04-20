import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, TextField, MenuItem, Chip, Alert,
  Button, Snackbar, InputAdornment, IconButton, CircularProgress, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  FormControl, InputLabel, Select,
} from '@mui/material';
import {
  Search as SearchIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  PersonAdd as PersonAddIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  Download as DownloadIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material';
import PendingIcon from '@mui/icons-material/Pending';
import axiosClient from '../../api/axiosClient';
import StatsCard from '../../components/StatsCard';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_CHIP_COLORS = {
  pending: '#1E88E5',
  rejected: '#DC2626',
  approved: '#1565C0',
  reviewed: '#1565C0',
};

const ROLE_OPTIONS = [
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'field_officer', label: 'Field Officer' },
  { value: 'accessor', label: 'Accessor' },
  { value: 'senior_valuer', label: 'Senior Valuer' },
  { value: 'md_gm', label: 'MD/GM' },
  { value: 'hr_head', label: 'HR Head' },
  { value: 'general_employee', label: 'General Employee' },
];

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatSalary = (amount) => Number(amount).toLocaleString('en-LK');

/* ------------------------------------------------------------------ */
/*  Detail Field (for expandable row)                                  */
/* ------------------------------------------------------------------ */

const DetailField = ({ label, value, children }) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography
      variant="caption"
      sx={{ color: 'primary.main', fontWeight: 600, display: 'block', mb: 0.25 }}
    >
      {label}
    </Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
      {children || value || '-'}
    </Typography>
  </Box>
);

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function EmployeeSubmissions() {
  /* ---- state ---- */
  const [submissions, setSubmissions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    reviewed: 0,
    approved: 0,
  });

  /* expandable row */
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* hire dialog */
  const [hireDialog, setHireDialog] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [salary, setSalary] = useState('');
  const [hireNotes, setHireNotes] = useState('');
  const [roleSalaries, setRoleSalaries] = useState({});

  /* snackbar */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  /* ================================================================ */
  /*  Data fetching                                                    */
  /* ================================================================ */

  useEffect(() => {
    (async () => {
      try {
        setRoleSalaries((await axiosClient.get('/auth/role-salaries/')).data);
      } catch {
        /* fallback */
      }
    })();
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await axiosClient.get('/auth/employee-submissions/', { params });
      const results = res.data.results || [];
      setSubmissions(results);
      setTotalCount(res.data.count || 0);

      if (res.data.summary) {
        setSummary({
          total: res.data.summary.total ?? 0,
          pending: res.data.summary.pending ?? 0,
          reviewed: res.data.summary.reviewed ?? 0,
          approved: res.data.summary.approved ?? 0,
        });
      } else {
        // Compute summary from visible results as fallback
        const total = res.data.count || results.length;
        setSummary({
          total,
          pending: results.filter((s) => s.status === 'pending').length,
          reviewed: results.filter((s) => s.status === 'reviewed').length,
          approved: results.filter((s) => s.status === 'approved').length,
        });
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to load submissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  /* ================================================================ */
  /*  Expandable row toggle                                            */
  /* ================================================================ */

  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /* ================================================================ */
  /*  Inline actions                                                   */
  /* ================================================================ */

  const handleMarkReviewed = async (e, sub) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await axiosClient.patch(`/auth/employee-submissions/${sub.id}/`, { status: 'reviewed' });
      showSnackbar('Status updated to Reviewed');
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to update', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e, sub) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await axiosClient.patch(`/auth/employee-submissions/${sub.id}/`, { status: 'rejected' });
      showSnackbar('Submission rejected');
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ================================================================ */
  /*  Hire flow                                                        */
  /* ================================================================ */

  const openHireDialog = (e, sub) => {
    e.stopPropagation();
    setHireDialog(sub);
    setSelectedRole('');
    setSalary('');
    setHireNotes(sub.notes || '');
  };

  const closeHireDialog = () => {
    if (!actionLoading) {
      setHireDialog(null);
      setSelectedRole('');
      setSalary('');
      setHireNotes('');
    }
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setSelectedRole(role);
    setSalary(roleSalaries[role] !== undefined ? String(roleSalaries[role]) : '');
  };

  const handleHire = async () => {
    if (!hireDialog || !selectedRole) return;
    setActionLoading(true);
    try {
      if (hireNotes !== (hireDialog.notes || '')) {
        await axiosClient.patch(`/auth/employee-submissions/${hireDialog.id}/`, { notes: hireNotes });
      }
      const payload = { role: selectedRole };
      if (salary) payload.salary = salary;
      const res = await axiosClient.post(`/auth/employee-submissions/${hireDialog.id}/hire/`, payload);
      showSnackbar(res.data.message || 'Employee account created. Credentials sent via email.');
      closeHireDialog();
      fetchSubmissions();
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to create account', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ================================================================ */
  /*  Pagination                                                       */
  /* ================================================================ */

  const handlePageChange = (_, newPage) => setPage(newPage);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <Box>
      {/* Page Title */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Employee Applications
      </Typography>

      {/* ========================================================== */}
      {/*  Summary Cards                                              */}
      {/* ========================================================== */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={PeopleIcon}
            title="Total Applications"
            value={summary.total}
            color="#1565C0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={PendingIcon}
            title="Pending"
            value={summary.pending}
            color="#1E88E5"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={ReviewIcon}
            title="Reviewed"
            value={summary.reviewed}
            color="#1565C0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={CheckCircleIcon}
            title="Approved"
            value={summary.approved}
            color="#1565C0"
          />
        </Grid>
      </Grid>

      {/* ========================================================== */}
      {/*  Search & Status Filter                                     */}
      {/* ========================================================== */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, email, NIC..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, minWidth: 280 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* ========================================================== */}
      {/*  Data Table                                                  */}
      {/* ========================================================== */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700, width: 40 }} />
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>NIC</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No employee applications found
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((sub) => {
                const isExpanded = expandedId === sub.id;
                const fullName =
                  [sub.first_name, sub.last_name].filter(Boolean).join(' ') || '-';

                return (
                  <Fragment key={sub.id}>
                    {/* Main Row */}
                    <TableRow
                      hover
                      onClick={() => handleToggleExpand(sub.id)}
                      sx={{ cursor: 'pointer', '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}
                    >
                      <TableCell sx={{ width: 40 }}>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{fullName}</TableCell>
                      <TableCell>{sub.email || '-'}</TableCell>
                      <TableCell>{sub.phone || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {sub.nic || '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            sub.status
                              ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
                              : 'Unknown'
                          }
                          size="small"
                          sx={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: STATUS_CHIP_COLORS[sub.status] || '#90CAF9',
                            bgcolor: `${STATUS_CHIP_COLORS[sub.status] || '#90CAF9'}15`,
                            border: `1px solid ${STATUS_CHIP_COLORS[sub.status] || '#90CAF9'}50`,
                            width: 110,
                            justifyContent: 'center',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {formatDate(sub.submitted_at)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {sub.status === 'approved' ? (
                            <Chip
                              label="Hired"
                              size="small"
                              sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#1565C0', bgcolor: '#1565C015', border: '1px solid #1565C050', width: 110, justifyContent: 'center' }}
                            />
                          ) : (
                            <>
                              {sub.status === 'pending' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => handleMarkReviewed(e, sub)}
                                  disabled={actionLoading}
                                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', width: 110 }}
                                >
                                  Review
                                </Button>
                              )}
                              {(sub.status === 'pending' || sub.status === 'reviewed') && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={(e) => handleReject(e, sub)}
                                  disabled={actionLoading}
                                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', width: 110 }}
                                >
                                  Reject
                                </Button>
                              )}
                              {sub.status !== 'rejected' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<PersonAddIcon />}
                                  onClick={(e) => openHireDialog(e, sub)}
                                  disabled={actionLoading}
                                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', width: 110 }}
                                >
                                  Hire
                                </Button>
                              )}
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Row */}
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        sx={{ py: 0, px: 0, borderBottom: isExpanded ? undefined : 'none' }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 3, bgcolor: 'grey.50' }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 700, mb: 2, color: '#1976d2' }}
                            >
                              Application Details
                            </Typography>
                            <Grid container spacing={3}>
                              {/* Left Column — Personal */}
                              <Grid item xs={12} md={4}>
                                <DetailField label="Full Name" value={fullName} />
                                <DetailField label="Email" value={sub.email} />
                                <DetailField label="Phone" value={sub.phone} />
                                <DetailField label="NIC" value={sub.nic} />
                              </Grid>

                              {/* Center Column */}
                              <Grid item xs={12} md={4}>
                                <DetailField label="Birthday" value={formatDate(sub.birthday)} />
                                <DetailField label="Address" value={sub.address} />
                                <Box sx={{ mb: 1.5 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'primary.main', fontWeight: 600, display: 'block', mb: 0.25 }}
                                  >
                                    CV
                                  </Typography>
                                  {sub.cv ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<DownloadIcon />}
                                      href={sub.cv}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                                    >
                                      Download CV
                                    </Button>
                                  ) : (
                                    <Typography variant="body2">Not uploaded</Typography>
                                  )}
                                </Box>
                              </Grid>

                              {/* Right Column — Submission meta */}
                              <Grid item xs={12} md={4}>
                                <DetailField label="Submitted" value={formatDateTime(sub.submitted_at)} />
                                <DetailField label="Reviewed" value={formatDateTime(sub.reviewed_at)} />
                                <DetailField label="Reviewed By" value={sub.reviewed_by} />
                                <DetailField label="Notes" value={sub.notes} />
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })
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
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>

      {/* ========================================================== */}
      {/*  Create Employee Account Dialog                              */}
      {/* ========================================================== */}
      <Dialog
        open={!!hireDialog}
        onClose={closeHireDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Create Employee Account</DialogTitle>
        <DialogContent dividers>
          {hireDialog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              {/* Applicant info */}
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Creating an account for{' '}
                <strong>
                  {[hireDialog.first_name, hireDialog.last_name].filter(Boolean).join(' ')}
                </strong>{' '}
                ({hireDialog.email})
              </Typography>

              {/* Role */}
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={selectedRole} label="Role" onChange={handleRoleChange}>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <span>{r.label}</span>
                        {roleSalaries[r.value] !== undefined && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', ml: 2 }}>
                            LKR {formatSalary(roleSalaries[r.value])}
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Salary */}
              <TextField
                fullWidth
                label="Basic Salary (LKR)"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">LKR</InputAdornment>,
                }}
                helperText="Auto-filled from role, but you can adjust"
              />

              {/* Notes */}
              <TextField
                fullWidth
                label="Additional Notes"
                multiline
                minRows={2}
                maxRows={4}
                value={hireNotes}
                onChange={(e) => setHireNotes(e.target.value)}
                placeholder="Add any notes about this hire..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeHireDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleHire}
            disabled={!selectedRole || actionLoading}
            startIcon={
              actionLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PersonAddIcon />
              )
            }
          >
            {actionLoading ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================== */}
      {/*  Snackbar                                                    */}
      {/* ========================================================== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
