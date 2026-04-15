import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, Alert } from '@mui/material';
import { PendingActions, CheckCircle, Assignment, RateReview } from '@mui/icons-material';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import valuationService from '../../services/valuationService';

export default function MDGMDashboard() {
  const [valuationStats, setValuationStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await valuationService.getMDGMValuations();
        const valuations = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setValuationStats({
          total: valuations.length,
          pending: valuations.filter(v => v.status === 'approved').length,
          approved: valuations.filter(v => v.status === 'md_approved').length,
          rejected: valuations.filter(v => v.status === 'rejected').length,
        });
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>MD / GM Dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary' }}>Valuations</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Total Valuations" value={valuationStats.total} icon={Assignment} color="#1565C0"
            onClick={() => navigate('/dashboard/md-gm-valuation-review')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Pending Approval" value={valuationStats.pending} icon={PendingActions} color="#1E88E5"
            onClick={() => navigate('/dashboard/md-gm-valuation-review', { state: { filter: 'pending' } })} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Approved" value={valuationStats.approved} icon={CheckCircle} color="#1565C0"
            onClick={() => navigate('/dashboard/md-gm-valuation-review', { state: { filter: 'approved' } })} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard title="Rejected" value={valuationStats.rejected} icon={RateReview} color="#0D47A1"
            onClick={() => navigate('/dashboard/md-gm-valuation-review', { state: { filter: 'rejected' } })} />
        </Grid>
      </Grid>
    </Box>
  );
}
