import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Alert, CircularProgress,
  Chip, Paper, Stack
} from '@mui/material';
import {
  Payment as PaymentIcon, CheckCircle, HourglassEmpty, AttachMoney
} from '@mui/icons-material';
import projectService from '../../services/projectService';

const AGENT_PAYMENT_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: '#1E88E5',
    bg: '#1E88E520',
    icon: HourglassEmpty,
    description: 'Payment has not been received yet'
  },
  paid: {
    label: 'Received',
    color: '#1565C0',
    bg: '#1565C020',
    icon: CheckCircle,
    description: 'Payment received successfully'
  },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function AgentPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async () => {
    try {
      const res = await projectService.getAgentPayments();
      const projects = res.data?.projects || [];
      const paymentsList = projects
        .filter(p => p.payment && p.payment.agent_payment_status)
        .map(p => ({
          id: p.payment.id,
          project_id: p.id,
          project_title: p.title,
          project_status: p.status,
          agent_payment_amount: p.payment.agent_payment_amount,
          agent_payment_status: p.payment.agent_payment_status,
          agent_paid_at: p.payment.agent_paid_at,
          agent_paid_by_name: p.payment.agent_paid_by_name,
          agent_payment_notes: p.payment.agent_payment_notes,
          coordinator_name: p.coordinator_name,
          created_at: p.created_at,
        }));
      setPayments(paymentsList);
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const pendingPayments = payments.filter(p => p.agent_payment_status === 'pending');
  const receivedPayments = payments.filter(p => p.agent_payment_status === 'paid');

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Payments
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View payments received from coordinators for your projects
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading payments...</Typography>
        </Box>
      ) : payments.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <PaymentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Payments Yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            When a coordinator records a payment for your project, it will appear here.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Pending Payments */}
          {pendingPayments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Pending ({pendingPayments.length})
              </Typography>
              <Stack spacing={2}>
                {pendingPayments.map((payment) => {
                  const config = AGENT_PAYMENT_STATUS_CONFIG.pending;
                  const IconComponent = config.icon;

                  return (
                    <Card key={payment.id}>
                      <CardContent sx={{ p: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {payment.project_title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <Chip
                                icon={<IconComponent sx={{ fontSize: 16 }} />}
                                label={config.label}
                                size="small"
                                sx={{
                                  bgcolor: config.bg,
                                  color: config.color,
                                  fontWeight: 600,
                                  border: `1px solid ${config.color}50`,
                                  '& .MuiChip-icon': { color: config.color }
                                }}
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {config.description}
                            </Typography>
                            {payment.coordinator_name && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Coordinator: {payment.coordinator_name}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="caption" color="text.secondary">Amount</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              -
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                              <HourglassEmpty sx={{ color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                Awaiting payment
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Grid>
          )}

          {/* Received Payments */}
          {receivedPayments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>
                Received ({receivedPayments.length})
              </Typography>
              <Stack spacing={2}>
                {receivedPayments.map((payment) => {
                  const config = AGENT_PAYMENT_STATUS_CONFIG.paid;
                  const IconComponent = config.icon;

                  return (
                    <Card key={payment.id}>
                      <CardContent sx={{ p: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {payment.project_title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <Chip
                                icon={<IconComponent sx={{ fontSize: 16 }} />}
                                label={config.label}
                                size="small"
                                sx={{
                                  bgcolor: config.bg,
                                  color: config.color,
                                  fontWeight: 600,
                                  border: `1px solid ${config.color}50`,
                                  '& .MuiChip-icon': { color: config.color }
                                }}
                              />
                            </Box>
                            {payment.agent_paid_at && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Received on {formatDate(payment.agent_paid_at)}
                              </Typography>
                            )}
                            {payment.coordinator_name && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                From: {payment.coordinator_name}
                              </Typography>
                            )}
                            {payment.agent_payment_notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                {payment.agent_payment_notes}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="caption" color="text.secondary">Amount Received</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              Rs. {Number(payment.agent_payment_amount).toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                              <AttachMoney sx={{ color: 'primary.main' }} />
                              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                                Payment Complete
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
