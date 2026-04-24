import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Alert, CircularProgress, InputAdornment, Chip, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import axiosClient from '../../api/axiosClient';
import LoadingSpinner from '../../components/LoadingSpinner';

const CATEGORIES = ['', 'land', 'building', 'vehicle', 'other'];

export default function AllProjectItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const theme = useTheme();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/report-items/all/', { params: { category: catFilter || undefined, search: search || undefined } });
      setItems(res.data?.results ?? res.data ?? []);
    } catch {
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [catFilter, search]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!items.length) return;
    const headers = ['ID', 'Project', 'Name', 'Category', 'Qty', 'Unit Value', 'Book Value', 'Created By', 'Date'];
    const rows = items.map(i => [
      i.id,
      i.project_title ?? i.project,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      i.category,
      i.quantity,
      i.unit_value,
      i.book_value ?? '',
      i.created_by_name ?? '',
      i.created_at?.slice(0, 10) ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report_items.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !items.length) return <LoadingSpinner />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>All Project Items</Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV} disabled={!items.length}>
          Export CSV
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          sx={{ minWidth: 250 }}
        />
        <TextField
          select size="small" label="Category" value={catFilter}
          onChange={e => setCatFilter(e.target.value)} sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All</MenuItem>
          {CATEGORIES.filter(Boolean).map(c => <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>)}
        </TextField>
      </Box>

      <Card sx={{ border: `1px solid ${theme.palette.divider}` }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Unit Value</TableCell>
                <TableCell align="right">Book Value</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.project_title ?? item.project}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <Chip label={item.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell align="right">{Number(item.unit_value).toLocaleString()}</TableCell>
                  <TableCell align="right">{item.book_value != null ? Number(item.book_value).toLocaleString() : '-'}</TableCell>
                  <TableCell>{item.created_by_name ?? '-'}</TableCell>
                  <TableCell>{item.created_at?.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
              {!items.length && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>No items found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
