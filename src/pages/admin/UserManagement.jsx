import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Select, MenuItem, IconButton, Alert, TextField, InputAdornment, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Delete, Search } from '@mui/icons-material';
import authService from '../../services/authService';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getRoleLabel } from '../../utils/roleConfig';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        authService.getAllUsers(),
        authService.getAvailableRoles(),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || []);
      const rolesData = rolesRes.data?.roles || rolesRes.data;
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    setError('');
    setSuccess('');
    try {
      await authService.assignRole(userId, newRole);
      setSuccess('Role updated successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign role');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    try {
      await authService.deleteUser(deleteConfirm);
      setSuccess('User deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
      setDeleteConfirm(null);
    }
  };

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>User Management</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TextField fullWidth placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        sx={{ mb: 3 }} size="small" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{u.username}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}</TableCell>
                <TableCell>
                  <Select
                    value={u.role || 'unassigned'}
                    size="small"
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    sx={{ minWidth: 140, fontSize: 13 }}
                    disabled={u.role === 'admin'}
                  >
                    {roles.map((r) => (
                      <MenuItem key={r.value || r} value={r.value || r}>{r.label || getRoleLabel(r)}</MenuItem>
                    ))}
                    <MenuItem value="unassigned">Unassigned</MenuItem>
                  </Select>
                </TableCell>
                <TableCell>
                  <IconButton color="error" size="small" onClick={() => setDeleteConfirm(u.id)} disabled={u.role === 'admin'}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        confirmColor="error"
      />
    </Box>
  );
}
