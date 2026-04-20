import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button, Alert,
  Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, IconButton, Tooltip, FormControl, InputLabel, TextField,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack, PersonAdd, PlayArrow, CheckCircle, Cancel, Lock, Edit,
  Timeline as TimelineIcon, Update, Description, Download, Delete, Visibility,
  EventNote, AssignmentInd, FactCheck, Payment, Send, Receipt,
  HourglassEmpty, AttachMoney, AssignmentTurnedIn, Block, AttachFile
} from '@mui/icons-material';
import projectService from '../../services/projectService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import { formatDate, formatDateTime, getPriorityColor, capitalize } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import ReportHistory from '../../components/ReportHistory';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assignDialog, setAssignDialog] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [starting, setStarting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState('');
  
  // Payment management states
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [rejectPaymentDialog, setRejectPaymentDialog] = useState(false);
  const [paymentRejectReason, setPaymentRejectReason] = useState('');
  
  // Cancellation request states
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancellationStatus, setCancellationStatus] = useState(null);

  // Agent payment states
  const [agentPaymentDialog, setAgentPaymentDialog] = useState(false);
  const [agentPaymentAmount, setAgentPaymentAmount] = useState('');
  const [agentPaymentNotes, setAgentPaymentNotes] = useState('');
  const [agentPaymentLoading, setAgentPaymentLoading] = useState(false);

  // Commission report states
  const [reportLoading, setReportLoading] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);

  // Document management states
  const [docUploading, setDocUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);

  // Admin approval request state
  const [approvalRequestLoading, setApprovalRequestLoading] = useState(false);

  const fetchProject = async () => {
    try {
      const res = await projectService.getProject(id);
      setProject(res.data);
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCancellationStatus = async () => {
    try {
      const res = await projectService.getCancellationStatus(id);
      setCancellationStatus(res.data);
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    fetchProject();
    fetchCancellationStatus();
  }, [id]);

  useEffect(() => {
    if (project) {
      setStatusToUpdate(project.status);
    }
  }, [project]);

  const openAssignDialog = async (type) => {
    setAssignDialog(type);
    try {
      const fetchers = {
        field_officer: projectService.getFieldOfficers,
        client: projectService.getClients,
        agent: projectService.getAgents,
        accessor: projectService.getAccessors,
        senior_valuer: projectService.getSeniorValuers,
      };
      const dataKeys = {
        field_officer: 'field_officers',
        client: 'clients',
        agent: 'agents',
        accessor: 'accessors',
        senior_valuer: 'senior_valuers',
      };
      const res = await fetchers[type]();
      const users = res.data?.[dataKeys[type]] || (Array.isArray(res.data) ? res.data : []);
      setAvailableUsers(users);
    } catch {
      setError('Failed to load users');
    }
  };

  const handleAssign = async () => {
    if (!selectedUser || !assignDialog) return;
    setError('');
    try {
      const assigners = {
        field_officer: projectService.assignFieldOfficer,
        client: projectService.assignClient,
        agent: projectService.assignAgent,
        accessor: projectService.assignAccessor,
        senior_valuer: projectService.assignSeniorValuer,
      };
      await assigners[assignDialog](id, selectedUser);
      setSuccess(`${assignDialog.replace(/_/g, ' ')} assigned!`);
      setAssignDialog(null);
      setSelectedUser('');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    setUpdatingStatus(true);
    setError('');
    try {
      await projectService.updateProject(id, { status: newStatus });
      setSuccess(`Project status updated to ${newStatus.replace(/_/g, ' ')}!`);
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStartProject = async () => {
    setStarting(true);
    setError('');
    try {
      await projectService.startProject(id);
      setSuccess('Project started successfully!');
      await fetchProject();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'string') {
        setError(data);
      } else if (Array.isArray(data)) {
        setError(data.join('. '));
      } else if (data?.detail) {
        setError(data.detail);
      } else if (data?.error) {
        setError(data.error);
      } else if (data && typeof data === 'object') {
        const msgs = Object.values(data).flat();
        setError(msgs.join('. '));
      } else {
        setError('Failed to start project');
      }
    } finally {
      setStarting(false);
    }
  };
  
  // Payment management handlers
  const handleSendPaymentRequest = async () => {
    setPaymentLoading(true);
    setError('');
    try {
      await projectService.sendPaymentRequest(id);
      setSuccess('Payment request sent to client!');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send payment request');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  const handleApprovePayment = async () => {
    setPaymentLoading(true);
    setError('');
    try {
      await projectService.approvePayment(id);
      setSuccess('Payment approved successfully! You can now start the project.');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve payment');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  const handleRejectPayment = async () => {
    if (!paymentRejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    setPaymentLoading(true);
    setError('');
    try {
      await projectService.rejectPayment(id, paymentRejectReason);
      setSuccess('Payment rejected. Client has been notified.');
      setRejectPaymentDialog(false);
      setPaymentRejectReason('');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject payment');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Cancellation request handler
  const handleRequestCancellation = async () => {
    if (!cancelReason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }
    setCancelLoading(true);
    setError('');
    try {
      await projectService.requestCancellation(id, cancelReason);
      setSuccess('Cancellation request submitted. Admin will review your request.');
      setCancelDialog(false);
      setCancelReason('');
      await fetchCancellationStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit cancellation request');
    } finally {
      setCancelLoading(false);
    }
  };

  // Agent payment handler
  const handleRecordAgentPayment = async () => {
    if (!agentPaymentAmount || Number(agentPaymentAmount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    setAgentPaymentLoading(true);
    setError('');
    try {
      await projectService.recordAgentPayment(id, {
        amount: agentPaymentAmount,
        notes: agentPaymentNotes,
      });
      setSuccess('Agent payment recorded successfully!');
      setAgentPaymentDialog(false);
      setAgentPaymentAmount('');
      setAgentPaymentNotes('');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record agent payment');
    } finally {
      setAgentPaymentLoading(false);
    }
  };

  // Commission report handlers
  const handleGenerateReport = async () => {
    setReportLoading(true);
    setError('');
    try {
      const res = await projectService.generateCommissionReport(id);
      setGeneratedReport(res.data.report);
      setReportDialog(true);
      setSuccess('Commission report generated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate commission report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!generatedReport) return;
    setSendingReport(true);
    setError('');
    try {
      await projectService.sendCommissionReport(generatedReport.id);
      setSuccess('Commission report sent to agent successfully!');
      setGeneratedReport({ ...generatedReport, sent_to_agent: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send commission report');
    } finally {
      setSendingReport(false);
    }
  };

  // Document handlers
  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setDocUploading(true);
    setError('');
    for (const file of files) {
      try {
        await projectService.uploadDocument({
          project: id,
          file,
          name: file.name.replace(/\.[^/.]+$/, ''),
        });
      } catch {
        setError(`Failed to upload ${file.name}`);
      }
    }
    e.target.value = '';
    await fetchProject();
    setDocUploading(false);
    setSuccess('Document(s) uploaded successfully');
  };

  const handleDeleteDocument = async (docId) => {
    setDeletingDocId(docId);
    setError('');
    try {
      await projectService.deleteDocument(docId);
      setSuccess('Document deleted');
      await fetchProject();
    } catch {
      setError('Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Admin approval request handler
  const handleRequestAdminApproval = async () => {
    setApprovalRequestLoading(true);
    setError('');
    try {
      await projectService.requestAdminApproval(id);
      setSuccess('Admin approval request sent successfully!');
      await fetchProject();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send approval request');
    } finally {
      setApprovalRequestLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return <Alert severity="error">Project not found</Alert>;

  const isCoordinator = role === 'coordinator';
  const isPending = project.status === 'pending';
  
  // Payment status
  const payment = project.payment;
  const paymentStatus = payment?.payment_status || 'pending';
  const isPaymentApproved = paymentStatus === 'approved';
  const agentPaymentStatus = payment?.agent_payment_status || 'pending';
  const isAgentPaid = agentPaymentStatus === 'paid';

  // Readiness check for starting the project
  const requiredAssignments = [
    { label: 'Field Officer', assigned: !!project.assigned_field_officer },
    { label: 'Client', assigned: !!project.assigned_client },
    { label: 'Accessor', assigned: !!project.assigned_accessor },
    { label: 'Senior Valuer', assigned: !!project.assigned_senior_valuer },
  ];
  if (project.has_agent) {
    requiredAssignments.splice(2, 0, { label: 'Agent', assigned: !!project.assigned_agent });
  }
  const allAssigned = requiredAssignments.every(r => r.assigned);
  const isAdminApproved = project.admin_approval_status === 'not_required' || project.admin_approval_status === 'approved';
  const canStartProject = allAssigned && isPaymentApproved && isAdminApproved;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      
      {/* Cancellation Request Status */}
      {cancellationStatus?.has_request && cancellationStatus?.request?.status === 'pending' && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<HourglassEmpty />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cancellation Request Pending</Typography>
          <Typography variant="body2">
            Your cancellation request is under review by the admin. Reason: {cancellationStatus.request.reason}
          </Typography>
        </Alert>
      )}
      {cancellationStatus?.has_request && cancellationStatus?.request?.status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cancellation Request Rejected</Typography>
          <Typography variant="body2">
            Admin remarks: {cancellationStatus.request.admin_remarks || 'No remarks provided'}
          </Typography>
        </Alert>
      )}

      {/* Admin Approval Status Alerts */}
      {project.admin_approval_status === 'not_submitted' && isCoordinator && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admin Approval Required</Typography>
              <Typography variant="body2">
                This project requires admin approval before it can be started. Click the button to send your request.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<Send />}
              onClick={handleRequestAdminApproval}
              disabled={approvalRequestLoading}
              sx={{ ml: 3, whiteSpace: 'nowrap', fontWeight: 600, minWidth: 'fit-content' }}
            >
              {approvalRequestLoading ? 'Sending...' : 'Request Approval'}
            </Button>
          </Box>
        </Alert>
      )}
      {project.admin_approval_status === 'pending' && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<HourglassEmpty />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admin Approval Pending</Typography>
          <Typography variant="body2">
            Your approval request has been sent and is awaiting admin review.
          </Typography>
        </Alert>
      )}
      {project.admin_approval_status === 'rejected' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admin Approval Rejected</Typography>
              <Typography variant="body2">
                Reason: {project.admin_rejection_reason || 'No reason provided'}
              </Typography>
            </Box>
            {isCoordinator && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<Send />}
                onClick={handleRequestAdminApproval}
                disabled={approvalRequestLoading}
                sx={{ ml: 2, whiteSpace: 'nowrap', fontWeight: 600 }}
              >
                {approvalRequestLoading ? 'Sending...' : 'Resubmit'}
              </Button>
            )}
          </Box>
        </Alert>
      )}
      {project.admin_approval_status === 'approved' && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Admin Approved</Typography>
          <Typography variant="body2">
            This project has been approved by the admin.
          </Typography>
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{project.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <StatusChip status={project.status} label={project.status_display || project.status} />
                <Chip label={capitalize(project.priority)} size="small" sx={{ bgcolor: `${getPriorityColor(project.priority)}20`, color: getPriorityColor(project.priority), fontWeight: 600, width: 110, justifyContent: 'center', border: `1px solid ${getPriorityColor(project.priority)}50` }} />
              </Box>
            </Box>
            {isCoordinator && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {project.status !== 'cancelled' && (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/dashboard/projects/${id}/edit`)}
                    sx={{ fontWeight: 600 }}
                  >
                    Edit
                  </Button>
                )}
                {isPending ? (
                  <Tooltip title={!canStartProject ? 'Please complete all requirements before starting the project' : ''}>
                    <span>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PlayArrow />}
                        onClick={handleStartProject}
                        disabled={starting || !canStartProject}
                        sx={{ fontWeight: 600 }}
                      >
                        {starting ? 'Starting...' : 'Start Project'}
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Update Status</InputLabel>
                    <Select
                      value={statusToUpdate}
                      label="Update Status"
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      disabled={updatingStatus}
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                    </Select>
                  </FormControl>
                )}
                {/* Cancel Project Button */}
                {project.status !== 'cancelled' && (!cancellationStatus?.has_request || cancellationStatus?.request?.status === 'rejected') && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Block />}
                    onClick={() => setCancelDialog(true)}
                    sx={{ fontWeight: 600 }}
                  >
                    Cancel Project
                  </Button>
                )}
              </Box>
            )}
          </Box>
          
          {project.description && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>Description</Typography>
              <Typography variant="body1">{project.description}</Typography>
            </Box>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Start Date</Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatDate(project.start_date)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>End Date</Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatDate(project.end_date)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Project Coordinator</Typography>
              <Typography sx={{ fontWeight: 600 }}>{project.coordinator_name || project.coordinator_username || '-'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Date Created</Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatDate(project.created_at)}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Project Requirements Checklist - shown only for coordinator when project is pending */}
      {isCoordinator && isPending && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentTurnedIn color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Project Requirements</Typography>
              </Box>
              <Chip
                label={`${requiredAssignments.filter(r => r.assigned).length + (isPaymentApproved ? 1 : 0) + (project.admin_approval_status !== 'not_required' && isAdminApproved ? 1 : 0)}/${requiredAssignments.length + 1 + (project.admin_approval_status !== 'not_required' ? 1 : 0)}`}
                size="small"
                color={canStartProject ? 'success' : 'default'}
                sx={{ fontWeight: 600 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {[...requiredAssignments, { label: 'Payment', assigned: isPaymentApproved }, ...(project.admin_approval_status !== 'not_required' ? [{ label: 'Admin Approval', assigned: isAdminApproved }] : [])].map(({ label, assigned }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {assigned ? (
                    <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />
                  ) : (
                    <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      border: '2px solid',
                      borderColor: 'grey.300'
                    }} />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 500, color: assigned ? 'text.primary' : 'text.secondary' }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
            
            {canStartProject && (
              <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
                All requirements met. Ready to start the project.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Payment Management - shown for coordinator when project is pending */}
      {isCoordinator && isPending && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Payment Management</Typography>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Rs. {Number(project.estimated_value || 50000).toLocaleString()}
              </Typography>
            </Box>

            {/* Status Steps */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              mb: 2,
              borderRadius: 1,
              bgcolor: (t) => t.palette.custom.cardInner
            }}>
              {[
                { key: 'request', label: 'Request', done: paymentStatus !== 'pending' },
                { key: 'payment', label: 'Payment', done: ['submitted', 'under_review', 'approved'].includes(paymentStatus) },
                { key: 'verification', label: 'Verification', done: paymentStatus === 'approved' },
                { key: 'completed', label: 'Completed', done: paymentStatus === 'approved' }
              ].map((step, index, arr) => (
                <Box
                  key={step.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
                    <Box sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: step.done ? 'success.main' : 'grey.300',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 0.5
                    }}>
                      {step.done ? (
                        <CheckCircle sx={{ fontSize: 16, color: 'white' }} />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: 11 }}>{index + 1}</Typography>
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 500, color: step.done ? 'success.main' : 'text.secondary' }}>
                      {step.label}
                    </Typography>
                  </Box>
                  {index < arr.length - 1 && (
                    <Box sx={{ flex: 1, height: 2, bgcolor: step.done ? 'success.main' : 'grey.200', mx: 1 }} />
                  )}
                </Box>
              ))}
            </Box>

            {/* Status and Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor:
                    paymentStatus === 'approved' ? 'success.main' :
                    paymentStatus === 'rejected' ? 'error.main' :
                    paymentStatus === 'submitted' || paymentStatus === 'under_review' ? 'info.main' :
                    paymentStatus === 'requested' ? 'warning.main' : 'grey.400'
                }} />
                <Typography variant="body2" color="text.secondary">
                  {paymentStatus === 'pending' ? 'Payment request not sent yet' :
                   paymentStatus === 'requested' ? 'Waiting for client to make payment' :
                   paymentStatus === 'submitted' ? 'Payment received, awaiting verification' :
                   paymentStatus === 'under_review' ? 'Payment is under verification' :
                   paymentStatus === 'approved' ? 'Payment verified successfully' :
                   paymentStatus === 'rejected' ? 'Payment verification failed' : 'Unknown status'}
                </Typography>
              </Box>

              {paymentStatus === 'pending' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={handleSendPaymentRequest}
                    disabled={paymentLoading || !project.assigned_client}
                    size="small"
                  >
                    {paymentLoading ? 'Sending...' : 'Send Request'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CheckCircle />}
                    onClick={handleApprovePayment}
                    disabled={paymentLoading}
                    size="small"
                    color="success"
                  >
                    {paymentLoading ? 'Processing...' : 'Mark as Paid'}
                  </Button>
                </Box>
              )}

              {paymentStatus === 'requested' && (
                <Button
                  variant="outlined"
                  startIcon={<CheckCircle />}
                  onClick={handleApprovePayment}
                  disabled={paymentLoading}
                  size="small"
                  color="success"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {paymentLoading ? 'Processing...' : 'Mark as Paid'}
                </Button>
              )}

              {(paymentStatus === 'submitted' || paymentStatus === 'under_review') && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {payment?.bank_slip_url && (
                    <Button
                      variant="outlined"
                      startIcon={<Receipt />}
                      href={payment.bank_slip_url}
                      target="_blank"
                      size="small"
                    >
                      View Receipt
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CheckCircle />}
                    onClick={handleApprovePayment}
                    disabled={paymentLoading}
                    size="small"
                  >
                    {paymentLoading ? 'Verifying...' : 'Verify'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => setRejectPaymentDialog(true)}
                    disabled={paymentLoading}
                    size="small"
                  >
                    Reject
                  </Button>
                </Box>
              )}
            </Box>

            {!project.assigned_client && paymentStatus === 'pending' && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 2 }}>
                Please assign a client before sending payment request.
              </Typography>
            )}

            {payment?.rejection_reason && paymentStatus === 'rejected' && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 2 }}>
                Reason: {payment.rejection_reason}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Agent Payment Section - shown when project has an agent */}
      {isCoordinator && project.has_agent && project.assigned_agent && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Agent Payment</Typography>
              </Box>
              {isAgentPaid && (
                <Chip
                  icon={<CheckCircle sx={{ fontSize: 16 }} />}
                  label="Paid"
                  size="small"
                  sx={{
                    bgcolor: '#1565C020',
                    color: '#1565C0',
                    fontWeight: 600,
                    border: '1px solid #1565C050',
                    '& .MuiChip-icon': { color: '#1565C0' }
                  }}
                />
              )}
            </Box>

            <Box sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2, mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Agent</Typography>
              <Typography sx={{ fontWeight: 600 }}>{project.assigned_agent_name || 'Assigned'}</Typography>
            </Box>

            {isAgentPaid ? (
              <Box sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Amount Paid</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      Rs. {Number(payment.agent_payment_amount).toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Paid On</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{formatDate(payment.agent_paid_at)}</Typography>
                  </Grid>
                  {payment.agent_payment_notes && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Notes</Typography>
                      <Typography variant="body2">{payment.agent_payment_notes}</Typography>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Button
                      variant="outlined"
                      startIcon={<Description />}
                      onClick={handleGenerateReport}
                      disabled={reportLoading}
                      size="small"
                    >
                      {reportLoading ? 'Generating...' : 'Generate Commission Report'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Button
                variant="contained"
                startIcon={<AttachMoney />}
                onClick={() => setAgentPaymentDialog(true)}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Record Agent Payment
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AssignmentInd color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Team Assignments</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Team members assigned to this project
          </Typography>
          <Grid container spacing={3}>
            {/* First column: Field Officer, Accessor, Senior Valuer */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: 'Field Officer', key: 'assigned_field_officer', type: 'field_officer', nameKey: 'assigned_field_officer_name' },
                  { label: 'Accessor', key: 'assigned_accessor', type: 'accessor', nameKey: 'assigned_accessor_name' },
                  { label: 'Senior Valuer', key: 'assigned_senior_valuer', type: 'senior_valuer', nameKey: 'assigned_senior_valuer_name' },
                ].map(({ label, key, type, nameKey }) => (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{project[nameKey] || (project[key] ? `User #${project[key]}` : 'Not Assigned')}</Typography>
                    </Box>
                    {isCoordinator && (
                      <Button size="small" variant="outlined" startIcon={<PersonAdd />} onClick={() => openAssignDialog(type)}>
                        {project[key] ? 'Reassign' : 'Assign'}
                      </Button>
                    )}
                  </Box>
                ))}
              </Box>
            </Grid>
            {/* Second column: Client, Agent (if applicable) */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { label: 'Client', key: 'assigned_client', type: 'client', nameKey: 'assigned_client_name' },
                  ...(project.has_agent ? [{ label: 'Agent', key: 'assigned_agent', type: 'agent', nameKey: 'assigned_agent_name' }] : []),
                ].map(({ label, key, type, nameKey }) => (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{project[nameKey] || (project[key] ? `User #${project[key]}` : 'Not Assigned')}</Typography>
                    </Box>
                    {isCoordinator && (
                      <Chip icon={<Lock />} label="Assigned at Creation" size="small" variant="outlined" color="default" />
                    )}
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {project.client_info && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Client Information</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Contact details of the client associated with this project
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Full Name</Typography>
                <Typography sx={{ fontWeight: 600 }}>{project.client_info.name || '-'}</Typography>
              </Box>
              <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Email Address</Typography>
                <Typography sx={{ fontWeight: 600 }}>{project.client_info.email || '-'}</Typography>
              </Box>
              <Box sx={{ minWidth: 120, flex: '1 1 auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Phone Number</Typography>
                <Typography sx={{ fontWeight: 600 }}>{project.client_info.phone || '-'}</Typography>
              </Box>
              <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Company</Typography>
                <Typography sx={{ fontWeight: 600 }}>{project.client_info.company || '-'}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!assignDialog} onClose={() => { setAssignDialog(null); setSelectedUser(''); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            Assign {assignDialog?.replace(/_/g, ' ')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please select a {assignDialog?.replace(/_/g, ' ')} to assign to this project.
          </Typography>
          <Select
            fullWidth
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            displayEmpty
            sx={{ mt: 1 }}
          >
            <MenuItem value="" disabled>
              {assignDialog === 'field_officer' && 'Select a Field Officer'}
              {assignDialog === 'accessor' && 'Select an Accessor'}
              {assignDialog === 'senior_valuer' && 'Select a Senior Valuer'}
              {assignDialog === 'client' && 'Select a Client'}
              {assignDialog === 'agent' && 'Select an Agent'}
            </MenuItem>
            {availableUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username}
                {u.email ? ` (${u.email})` : ''}
                {u.assigned_projects_count > 0 ? ` — ${u.assigned_projects_count} project${u.assigned_projects_count > 1 ? 's' : ''}` : ''}
              </MenuItem>
            ))}
          </Select>
          {availableUsers.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
              No {assignDialog?.replace(/_/g, ' ')}s are currently available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAssignDialog(null); setSelectedUser(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={!selectedUser}>Confirm Assignment</Button>
        </DialogActions>
      </Dialog>

      {/* Project Documents */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachFile color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Project Documents</Typography>
            </Box>
            {isCoordinator && project.status !== 'cancelled' && (
              <Button
                variant="outlined"
                component="label"
                size="small"
                startIcon={<Description />}
                disabled={docUploading}
              >
                {docUploading ? 'Uploading...' : 'Upload Document'}
                <input type="file" hidden multiple onChange={handleDocumentUpload} />
              </Button>
            )}
          </Box>

          {docUploading && <LinearProgress sx={{ mb: 2 }} />}

          {project.documents && project.documents.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {project.documents.map((doc) => (
                <Box
                  key={doc.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    bgcolor: (t) => t.palette.custom?.cardInner || (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f7fa'),
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <Description sx={{ color: 'primary.main' }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(doc.file_size)} &middot; Uploaded {formatDate(doc.uploaded_at)}
                        {doc.uploaded_by_username ? ` by ${doc.uploaded_by_username}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title="View">
                      <IconButton size="small" href={doc.file_url} target="_blank" component="a">
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isCoordinator && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={deletingDocId === doc.id}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Description sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No documents have been attached to this project.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Project Timeline & Approved Reports */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 400 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimelineIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Project Timeline</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Activity history and status updates
              </Typography>

              {project.history && project.history.length > 0 ? (
                <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', left: 8, top: 10, bottom: 10, width: '2px', bgcolor: 'divider' } }}>
                  {project.history.slice().reverse().map((event, index) => (
                    <Box key={event.id} sx={{ mb: 3, position: 'relative' }}>
                      <Box sx={{
                        position: 'absolute',
                        left: -21,
                        top: 4,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: index === 0 ? 'primary.main' : 'divider',
                        border: '2px solid white',
                        boxShadow: '0 0 0 2px rgba(0,0,0,0.05)',
                        zIndex: 1,
                      }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {event.status_display || event.status}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {event.notes}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AssignmentInd sx={{ fontSize: 14 }} /> {event.created_by_name || event.created_by_username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">•</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EventNote sx={{ fontSize: 14 }} /> {formatDate(event.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No activity has been recorded yet.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 400 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <FactCheck color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Final Valuation Reports</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Approved reports available for download
              </Typography>

              {project.valuations && project.valuations.filter(v => v.status === 'approved').length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {project.valuations.filter(v => v.status === 'approved').map(valuation => (
                    <Box key={valuation.id} sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {valuation.category_display} Report
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Approved by Senior Valuer
                          </Typography>
                        </Box>
                        {valuation.final_report_url && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            href={valuation.final_report_url}
                            target="_blank"
                          >
                            PDF
                          </Button>
                        )}
                      </Box>
                      {valuation.senior_valuer_comments && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary', fontSize: '0.8125rem' }}>
                          "{valuation.senior_valuer_comments}"
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Description sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No approved reports are available at this time.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Valuation Report History */}
      {project.valuations && project.valuations.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TimelineIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Valuation Report History</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Submission and review history for each valuation report
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {project.valuations.map(v => (
                <Box key={v.id} sx={{ p: 2, bgcolor: (t) => t.palette.custom.cardInner, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {v.category_display || v.category || 'Valuation'}
                    </Typography>
                    <StatusChip status={v.status} label={v.status_display || v.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Field Officer: {v.field_officer_name || v.field_officer_username}
                  </Typography>
                  <ReportHistory history={v.history} />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Payment Rejection Dialog */}
      <Dialog open={rejectPaymentDialog} onClose={() => !paymentLoading && setRejectPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
            Reject Payment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this payment. The client will be notified and may re-submit a bank slip.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Please specify the reason for rejection (e.g., bank slip is unclear, amount does not match the invoice, etc.)"
            value={paymentRejectReason}
            onChange={(e) => setPaymentRejectReason(e.target.value)}
            required
            error={!paymentRejectReason.trim() && rejectPaymentDialog}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectPaymentDialog(false)} disabled={paymentLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectPayment}
            disabled={paymentLoading || !paymentRejectReason.trim()}
          >
            {paymentLoading ? 'Processing...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Cancellation Request Dialog */}
      <Dialog open={cancelDialog} onClose={() => !cancelLoading && setCancelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
            Request Project Cancellation
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for cancelling this project. Your request will be sent to the admin for review. All assigned team members will be notified of the decision.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Cancellation Reason"
            placeholder="Please explain why this project needs to be cancelled..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            required
            error={!cancelReason.trim() && cancelDialog}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelDialog(false)} disabled={cancelLoading}>
            Go Back
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRequestCancellation}
            disabled={cancelLoading || !cancelReason.trim()}
            startIcon={<Block />}
          >
            {cancelLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Agent Payment Dialog */}
      <Dialog open={agentPaymentDialog} onClose={() => !agentPaymentLoading && setAgentPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Record Agent Payment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Record the payment made to the agent for this project. The agent will be able to see this in their payments tab.
          </Typography>
          <TextField
            fullWidth
            label="Payment Amount (Rs.)"
            type="number"
            value={agentPaymentAmount}
            onChange={(e) => setAgentPaymentAmount(e.target.value)}
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes (Optional)"
            placeholder="Any notes about this payment..."
            value={agentPaymentNotes}
            onChange={(e) => setAgentPaymentNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAgentPaymentDialog(false)} disabled={agentPaymentLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRecordAgentPayment}
            disabled={agentPaymentLoading || !agentPaymentAmount || Number(agentPaymentAmount) <= 0}
            startIcon={<AttachMoney />}
          >
            {agentPaymentLoading ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Commission Report Dialog */}
      <Dialog open={reportDialog} onClose={() => { setReportDialog(false); setGeneratedReport(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Commission Report
          </Typography>
        </DialogTitle>
        <DialogContent>
          {generatedReport && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Commission report generated successfully!
              </Alert>
              <Box sx={{ p: 2, bgcolor: (t) => t.palette.custom?.cardInner || '#f5f5f5', borderRadius: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Project</Typography>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>{generatedReport.project_title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Agent</Typography>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>{generatedReport.agent_name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Commission Amount</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  Rs. {Number(generatedReport.commission_amount).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {generatedReport.report_file_url && (
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    href={generatedReport.report_file_url}
                    target="_blank"
                    size="small"
                  >
                    Download Report
                  </Button>
                )}
                {!generatedReport.sent_to_agent && (
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={handleSendReport}
                    disabled={sendingReport}
                    size="small"
                  >
                    {sendingReport ? 'Sending...' : 'Send to Agent'}
                  </Button>
                )}
                {generatedReport.sent_to_agent && (
                  <Alert severity="info" sx={{ flex: 1 }}>
                    Report has been sent to the agent.
                  </Alert>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setReportDialog(false); setGeneratedReport(null); }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
