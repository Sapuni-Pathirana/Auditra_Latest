import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Card, CardContent, Button, Alert,
} from '@mui/material';
import { Visibility, Download } from '@mui/icons-material';
import paymentService from '../../services/paymentService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { viewPaymentSlipPDF, downloadPaymentSlipPDF } from '../../utils/generatePaymentPDF';

export default function MyPaymentSlips() {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSlips = async () => {
      try {
        const res = await paymentService.getMySlips();
        setSlips(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (err) {
        setError('Failed to load payment slips');
      } finally {
        setLoading(false);
      }
    };
    fetchSlips();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>My Payment Slips</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {slips.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary" align="center">No payment slips found</Typography></CardContent></Card>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '10%' }}>Month</TableCell>
                <TableCell sx={{ width: '15%' }}>Basic Salary</TableCell>
                <TableCell sx={{ width: '13%' }}>Allowances</TableCell>
                <TableCell sx={{ width: '13%' }}>Overtime</TableCell>
                <TableCell sx={{ width: '12%' }}>EPF</TableCell>
                <TableCell sx={{ width: '15%' }}>Net Salary</TableCell>
                <TableCell sx={{ width: '22%' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {slips.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.month || formatDate(s.created_at)}</TableCell>
                  <TableCell>{formatCurrency(s.salary)}</TableCell>
                  <TableCell>{formatCurrency(s.allowances)}</TableCell>
                  <TableCell>{formatCurrency(s.overtime_pay)}</TableCell>
                  <TableCell>{formatCurrency(s.epf_contribution)}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
