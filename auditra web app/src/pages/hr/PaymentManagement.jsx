import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, TextField, Grid, Card, CardContent,
  MenuItem, InputAdornment
} from '@mui/material';
import { Add, Upload, PictureAsPdf, Visibility, Download, Search } from '@mui/icons-material';
import paymentService from '../../services/paymentService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCurrency } from '../../utils/helpers';
import { viewPaymentSlipPDF, downloadPaymentSlipPDF, downloadAllPaymentSlipPDFs } from '../../utils/generatePaymentPDF';

export default function PaymentManagement() {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const fetchSlips = async () => {
    try {
      const res = await paymentService.getAllSlips();
      setSlips(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setError('Failed to load payment slips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlips(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      await paymentService.generateSlips({ month: genMonth, year: genYear });
      setSuccess('Payment slips generated successfully!');
      fetchSlips();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate slips');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    setSuccess('');
    try {
      await paymentService.publishSlips({ month: genMonth, year: genYear });
      setSuccess('Payment slips published to employees successfully!');
      fetchSlips();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish slips');
    } finally {
      setPublishing(false);
    }
  };

  const MONTHS = [
    { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
    { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
    { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
    { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' }
  ];

  const filteredSlips = slips.filter(s => {
    const monthMatch = !filterMonth || s.month === filterMonth;
    const yearMatch = !filterYear || String(s.year) === String(filterYear);
    const q = searchQuery.toLowerCase().trim();
    const searchMatch = !q ||
      (s.user_full_name || s.user_username || s.employee_name || '').toLowerCase().includes(q) ||
      String(s.employee_number || s.user || '').toLowerCase().includes(q);
    return monthMatch && yearMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Payment Management</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Generate Payment Slips</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={4}>
              <TextField select fullWidth label="Month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)}
                size="small">
                {MONTHS.map((m) => <MenuItem key={m.v} value={m.v}>{m.l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Year" value={genYear} onChange={(e) => setGenYear(e.target.value)} size="small" />
            </Grid>
            <Grid item xs={2}>
              <Button variant="contained" startIcon={<Add />} onClick={handleGenerate} disabled={generating} fullWidth>
                {generating ? 'Generating...' : 'Generate'}
              </Button>
            </Grid>
            <Grid item xs={2}>
              <Button variant="outlined" color="primary" startIcon={<Upload />} onClick={handlePublish} disabled={publishing} fullWidth>
                {publishing ? 'Publishing...' : 'Publish'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {slips.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Filter Month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All Months</MenuItem>
            {MONTHS.map((m) => <MenuItem key={m.v} value={m.v}>{m.l}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            label="Filter Year"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            sx={{ width: 120 }}
          />
          <TextField
            size="small"
            placeholder="Search by employee name or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PictureAsPdf />}
            onClick={() => downloadAllPaymentSlipPDFs(filteredSlips)}
            disabled={filteredSlips.length === 0}
          >
            Download All PDFs{filterMonth ? ` (${MONTHS.find(m => m.v === filterMonth)?.l || ''})` : ''}
          </Button>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '18%' }}>Employee</TableCell>
              <TableCell sx={{ width: '8%' }}>Month</TableCell>
              <TableCell sx={{ width: '14%' }}>Basic</TableCell>
              <TableCell sx={{ width: '10%' }}>OT Hours</TableCell>
              <TableCell sx={{ width: '14%' }}>OT Pay</TableCell>
              <TableCell sx={{ width: '14%' }}>Net Salary</TableCell>
              <TableCell sx={{ width: '22%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSlips.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">{searchQuery || filterMonth || filterYear ? 'No matching payment slips found' : 'No payment slips found'}</TableCell></TableRow>
            ) : (
              filteredSlips.map((s) => (
                <TableRow key={s.id}>
                  <TableCell sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user_username || s.employee_name || '-'}</TableCell>
                  <TableCell>{s.month || '-'}</TableCell>
                  <TableCell>{formatCurrency(s.salary)}</TableCell>
                  <TableCell>{s.overtime_hours || 0}</TableCell>
                  <TableCell>{formatCurrency(s.overtime_pay)}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCurrency(s.net_salary)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Button size="small" variant="outlined" color="primary" startIcon={<Visibility />} onClick={() => viewPaymentSlipPDF(s)}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1 }}>View</Button>
                      <Button size="small" variant="outlined" color="primary" startIcon={<Download />} onClick={() => downloadPaymentSlipPDF(s)}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1 }}>Download</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
