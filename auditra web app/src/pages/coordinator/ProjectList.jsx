import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, Chip,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import PriorityChip from '../../components/PriorityChip';
import TabFilters from '../../components/TabFilters';
import { useAuth } from '../../contexts/AuthContext';
import useCoordinatorProjects from '../../hooks/useCoordinatorProjects';

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
  const { projects, loading, error } = useCoordinatorProjects();
  const location = useLocation();
  const initialTab = STATUS_TAB_MAP[location.state?.filter] || 0;
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { role } = useAuth();

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
        searchSx={{ mb: 2 }}
        searchSize="small"
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ textAlign: 'left' }}>Title</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Priority</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Status</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Payment Status</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Admin Approval</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No projects found</TableCell></TableRow>
            ) : (
              filtered.map((p) => {
                const paymentStatus = p.payment?.payment_status || 'pending';
                const paymentConfig = PAYMENT_STATUS_CONFIG[paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
                
                return (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                    <TableCell sx={{ fontWeight: 600, textAlign: 'left' }}>{p.title}</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <PriorityChip priority={p.priority} />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}><StatusChip status={p.status} label={p.status_display || p.status} /></TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
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
                    <TableCell sx={{ textAlign: 'center' }}>
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
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
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
