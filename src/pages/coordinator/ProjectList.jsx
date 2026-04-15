import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, TextField, InputAdornment, Alert, Chip,
  Tooltip,
} from '@mui/material';
import { Search, Add, Visibility } from '@mui/icons-material';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDate, getPriorityColor, capitalize } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_TAB_MAP = { pending: 1, in_progress: 2, completed: 3 };

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Not Requested', color: '#90CAF9', bg: '#90CAF920' },
  requested: { label: 'Awaiting Payment', color: '#1E88E5', bg: '#1E88E520' },
  submitted: { label: 'Slip Uploaded', color: '#1565C0', bg: '#1565C020' },
  under_review: { label: 'Under Review', color: '#1565C0', bg: '#1565C020' },
  approved: { label: 'Completed', color: '#1565C0', bg: '#1565C020' },
  rejected: { label: 'Payment Rejected', color: '#DC2626', bg: '#DC262620' },
};

const ADMIN_APPROVAL_CONFIG = {
  not_submitted: { label: 'Not Submitted', color: '#757575', bg: '#75757520' },
  pending: { label: 'Pending', color: '#ED6C02', bg: '#ED6C0220' },
  approved: { label: 'Approved', color: '#1565C0', bg: '#1565C020' },
  rejected: { label: 'Rejected', color: '#D32F2F', bg: '#D32F2F20' },
};

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const initialTab = STATUS_TAB_MAP[location.state?.filter] || 0;
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { role } = useAuth();

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

  const statuses = ['', 'pending', 'in_progress', 'completed'];
  const filtered = projects
    .filter(p => !statuses[tab] || p.status === statuses[tab])
    .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Projects</Typography>
        {role === 'coordinator' && (
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/dashboard/projects/create')}>
            Create Project
          </Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${projects.length})`} />
        <Tab label={`Pending (${projects.filter(p => p.status === 'pending').length})`} />
        <Tab label={`In Progress (${projects.filter(p => p.status === 'in_progress').length})`} />
        <Tab label={`Completed (${projects.filter(p => p.status === 'completed').length})`} />
      </Tabs>

      <TextField fullWidth placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        sx={{ mb: 2 }} size="small" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Payment Status</TableCell>
              <TableCell>Admin Approval</TableCell>
              <TableCell>Est. Value</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} align="center">No projects found</TableCell></TableRow>
            ) : (
              filtered.map((p) => {
                const paymentStatus = p.payment?.payment_status || 'pending';
                const paymentConfig = PAYMENT_STATUS_CONFIG[paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
                
                return (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{p.title}</TableCell>
                    <TableCell>
                      <Chip label={capitalize(p.priority)} size="small" sx={{ bgcolor: `${getPriorityColor(p.priority)}20`, color: getPriorityColor(p.priority), fontWeight: 600, fontSize: 12, width: 110, justifyContent: 'center', border: `1px solid ${getPriorityColor(p.priority)}50` }} />
                    </TableCell>
                    <TableCell><StatusChip status={p.status} label={p.status_display || p.status} /></TableCell>
                    <TableCell>
                      <Chip
                        label={paymentConfig.label}
                        size="small"
                        sx={{
                          bgcolor: paymentConfig.bg,
                          color: paymentConfig.color,
                          fontWeight: 600,
                          fontSize: 12,
                          width: 110,
                          justifyContent: 'center',
                          border: `1px solid ${paymentConfig.color}50`,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {p.admin_approval_status && p.admin_approval_status !== 'not_required' ? (() => {
                        const config = ADMIN_APPROVAL_CONFIG[p.admin_approval_status] || ADMIN_APPROVAL_CONFIG.pending;
                        return (
                          <Chip
                            label={config.label}
                            size="small"
                            sx={{
                              bgcolor: config.bg,
                              color: config.color,
                              fontWeight: 600,
                              fontSize: 12,
                              width: 110,
                              justifyContent: 'center',
                              border: `1px solid ${config.color}50`,
                            }}
                          />
                        );
                      })() : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.estimated_value ? `Rs. ${Number(p.estimated_value).toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>{formatDate(p.start_date)}</TableCell>
                    <TableCell>{formatDate(p.end_date)}</TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Visibility />} onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/projects/${p.id}`); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
