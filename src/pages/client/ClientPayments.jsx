import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Alert, Button, CircularProgress,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Divider,
  LinearProgress, Stack
} from '@mui/material';
import {
  Payment as PaymentIcon, CloudUpload, CheckCircle, HourglassEmpty,
  Receipt, AttachMoney, Warning, ErrorOutline, Visibility, Info
} from '@mui/icons-material';
import projectService from '../../services/projectService';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PAYMENT_STATUS_CONFIG = {
  pending: { 
    label: 'Not Requested', 
    color: '#90CAF9',
    bg: '#90CAF920', 
    icon: HourglassEmpty,
    description: 'Payment has not been requested yet'
  },
  requested: {
    label: 'Payment Requested',
    color: '#1E88E5',
    bg: '#1E88E520',
    icon: Warning,
    description: 'Please upload your bank slip to proceed'
  },
  submitted: { 
    label: 'Bank Slip Uploaded', 
    color: '#1565C0', 
    bg: '#1565C020', 
    icon: Receipt,
    description: 'Waiting for coordinator review'
  },
  under_review: { 
    label: 'Under Review', 
    color: '#1565C0', 
    bg: '#1565C020', 
    icon: Visibility,
    description: 'Your payment is being verified'
  },
  approved: {
    label: 'Completed',
    color: '#1565C0',
    bg: '#1565C020',
    icon: CheckCircle,
    description: 'Payment verified successfully'
  },
  rejected: { 
    label: 'Payment Rejected', 
    color: '#DC2626', 
    bg: '#DC262620', 
    icon: ErrorOutline,
    description: 'Please re-upload a valid bank slip'
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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function ClientPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Upload dialog state
  const [uploadDialog, setUploadDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await projectService.getClientPayments();
      // Transform projects with payment data into flat payment objects
      const projects = res.data?.projects || [];
      const paymentsList = projects
        .filter(p => p.payment && p.payment.payment_status !== 'pending') // Only show projects with active payment requests
        .map(p => ({
          id: p.payment.id,
          project_id: p.id,
          project_title: p.title,
          project_status: p.status,
          estimated_value: p.payment.estimated_value || p.estimated_value,
          payment_status: p.payment.payment_status,
          payment_instructions: p.payment.payment_instructions,
          bank_slip_url: p.payment.bank_slip_url,
          rejection_reason: p.payment.payment_rejection_reason,
          coordinator_name: p.coordinator_name,
          payment_requested_at: p.payment.payment_requested_at,
          payment_submitted_at: p.payment.bank_slip_uploaded_at,
          payment_approved_at: p.payment.payment_approved_at,
        }));
      setPayments(paymentsList);
    } catch (err) {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleOpenUpload = (payment) => {
    setSelectedPayment(payment);
    setSelectedFile(null);
    setUploadDialog(true);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedPayment) return;

    setUploading(true);
    setError('');
    try {
      await Promise.all([
        projectService.uploadBankSlip(selectedPayment.project_id, selectedFile),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
      setUploading(false);
      setSuccess('Bank slip uploaded successfully! Waiting for coordinator review.');
      setUploadDialog(false);
      setSelectedPayment(null);
      setSelectedFile(null);
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload bank slip');
      setUploading(false);
    }
  };

  const pendingPayments = payments.filter(p => p.payment_status === 'requested' || p.payment_status === 'rejected');
  const inProgressPayments = payments.filter(p => p.payment_status === 'submitted' || p.payment_status === 'under_review');
  const completedPayments = payments.filter(p => p.payment_status === 'approved');

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Payments
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your project payments and upload bank slips
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading payments...</Typography>
        </Box>
      ) : payments.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <PaymentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No Payment Requests
          </Typography>
          <Typography variant="body2" color="text.disabled">
            When a coordinator requests payment for your project, it will appear here.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Payment Instructions Card */}
          <Grid item xs={12}>
            <Alert severity="info" icon={<Info />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Payment Instructions
              </Typography>
              <Typography variant="body2">
                Please make your payment to the following bank account and upload the bank slip:
              </Typography>
              <Box sx={{ mt: 1, ml: 2 }}>
                <Typography variant="body2">• Bank: Peoples Bank</Typography>
                <Typography variant="body2">• Account Name: Auditra (Pvt) Ltd</Typography>
                <Typography variant="body2">• Account Number: 123-456-7890</Typography>
                <Typography variant="body2">• Branch: Colombo Main Branch</Typography>
              </Box>
            </Alert>
          </Grid>

          {/* Action Required Section */}
          {pendingPayments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Action Required ({pendingPayments.length})
              </Typography>
              <Stack spacing={2}>
                {pendingPayments.map((payment) => {
                  const config = PAYMENT_STATUS_CONFIG[payment.payment_status] || PAYMENT_STATUS_CONFIG.pending;
                  const IconComponent = config.icon;
                  const isRejected = payment.payment_status === 'rejected';
                  
                  return (
                    <Card key={payment.id} sx={{ border: '2px solid', borderColor: isRejected ? 'error.main' : 'warning.main' }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Rejection Notice Banner */}
                        {isRejected && payment.rejection_reason && (
                          <Alert 
                            severity="error" 
                            icon={<ErrorOutline />}
                            sx={{ 
                              mb: 2, 
                              '& .MuiAlert-message': { width: '100%' }
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                              Payment Rejected by Coordinator
                            </Typography>
                            <Typography variant="body2">
                              <strong>Reason:</strong> {payment.rejection_reason}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                              Please upload a corrected bank slip to proceed.
                            </Typography>
                          </Alert>
                        )}
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
                              {!isRejected && config.description}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="caption" color="text.secondary">Amount Due</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              Rs. {Number(payment.estimated_value).toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Button
                              variant="contained"
                              startIcon={<CloudUpload />}
                              onClick={() => handleOpenUpload(payment)}
                              fullWidth
                              sx={{ fontWeight: 600 }}
                            >
                              Upload Bank Slip
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Grid>
          )}

          {/* In Progress Section */}
          {inProgressPayments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'info.main' }}>
                Under Review ({inProgressPayments.length})
              </Typography>
              <Stack spacing={2}>
                {inProgressPayments.map((payment) => {
                  const config = PAYMENT_STATUS_CONFIG[payment.payment_status] || PAYMENT_STATUS_CONFIG.pending;
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
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="caption" color="text.secondary">Amount</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              Rs. {Number(payment.estimated_value).toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            {payment.bank_slip_url && (
                              <Button
                                variant="outlined"
                                startIcon={<Receipt />}
                                href={payment.bank_slip_url}
                                target="_blank"
                                fullWidth
                              >
                                View Slip
                              </Button>
                            )}
                          </Grid>
                        </Grid>
                        <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Grid>
          )}

          {/* Completed Section */}
          {completedPayments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'success.main' }}>
                Completed ({completedPayments.length})
              </Typography>
              <Stack spacing={2}>
                {completedPayments.map((payment) => {
                  const config = PAYMENT_STATUS_CONFIG[payment.payment_status];
                  const IconComponent = config.icon;
                  
                  return (
                    <Card key={payment.id} sx={{ opacity: 0.85 }}>
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
                            {payment.approved_at && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Approved on {formatDate(payment.approved_at)}
                              </Typography>
                            )}
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Typography variant="caption" color="text.secondary">Amount Paid</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                              Rs. {Number(payment.estimated_value).toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            {payment.bank_slip_url && (
                              <Button
                                variant="outlined"
                                startIcon={<Receipt />}
                                href={payment.bank_slip_url}
                                target="_blank"
                                fullWidth
                                size="small"
                              >
                                View Slip
                              </Button>
                            )}
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

      {/* Upload Bank Slip Dialog */}
      <Dialog open={uploadDialog} onClose={() => !uploading && setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Upload Bank Slip
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ mb: 3 }}>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selectedPayment.project_title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 1 }}>
                  Rs. {Number(selectedPayment.estimated_value).toLocaleString()}
                </Typography>
              </Paper>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                Please upload a clear image or PDF of your bank transfer receipt/slip.
              </Alert>

              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: selectedFile ? 'success.main' : 'divider',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  bgcolor: selectedFile ? 'success.50' : 'grey.50',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                  },
                }}
                onClick={() => document.getElementById('bank-slip-input').click()}
              >
                <input
                  id="bank-slip-input"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {selectedFile ? (
                  <>
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click to change file
                    </Typography>
                  </>
                ) : (
                  <>
                    <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Click to select bank slip
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Supports: JPG, PNG, PDF (max 10MB)
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadDialog(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
          >
            {uploading ? 'Uploading...' : 'Upload Bank Slip'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
