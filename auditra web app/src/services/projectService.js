import axiosClient from '../api/axiosClient';

const projectService = {
  getProjects: () =>
    axiosClient.get('/projects/'),

  getProject: (id) =>
    axiosClient.get(`/projects/${id}/`),

  createProject: (data) =>
    axiosClient.post('/projects/', data),

  updateProject: (id, data) =>
    axiosClient.patch(`/projects/${id}/`, data),

  deleteProject: (id) =>
    axiosClient.delete(`/projects/${id}/`),

  assignFieldOfficer: (projectId, userId) =>
    axiosClient.post(`/projects/${projectId}/assign-field-officer/`, { field_officer_id: userId }),

  assignClient: (projectId, userId) =>
    axiosClient.post(`/projects/${projectId}/assign-client/`, { client_id: userId }),

  assignAgent: (projectId, userId) =>
    axiosClient.post(`/projects/${projectId}/assign-agent/`, { agent_id: userId }),

  assignAccessor: (projectId, userId) =>
    axiosClient.post(`/projects/${projectId}/assign-accessor/`, { accessor_id: userId }),

  assignSeniorValuer: (projectId, userId) =>
    axiosClient.post(`/projects/${projectId}/assign-senior-valuer/`, { senior_valuer_id: userId }),

  getFieldOfficers: () =>
    axiosClient.get('/projects/field-officers/'),

  getClients: () =>
    axiosClient.get('/projects/clients/'),

  getAgents: () =>
    axiosClient.get('/projects/agents/'),

  getAccessors: () =>
    axiosClient.get('/projects/accessors/'),

  getSeniorValuers: () =>
    axiosClient.get('/projects/senior-valuers/'),

  uploadDocument: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value != null) formData.append(key, value);
    });
    return axiosClient.post('/projects/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocument: (id) =>
    axiosClient.delete(`/projects/documents/${id}/`),

  mdGmApprove: (projectId) =>
    axiosClient.post(`/projects/${projectId}/md-gm-approve/`),

  mdGmReject: (projectId) =>
    axiosClient.post(`/projects/${projectId}/md-gm-reject/`),

  // Admin approval endpoints (for direct projects)
  adminApprove: (projectId) =>
    axiosClient.post(`/projects/${projectId}/admin-approve/`),

  adminReject: (projectId, reason) =>
    axiosClient.post(`/projects/${projectId}/admin-reject/`, { reason }),

  requestAdminApproval: (projectId) =>
    axiosClient.post(`/projects/${projectId}/request-admin-approval/`),

  getAdminPendingProjects: (status = 'all') =>
    axiosClient.get('/projects/admin-pending-projects/', { params: { status } }),

  checkEmail: (email, roleType) =>
    axiosClient.post('/projects/check-email/', { email, role_type: roleType }),

  // Payment workflow methods
  sendPaymentRequest: (projectId, data = {}) =>
    axiosClient.post(`/projects/${projectId}/send-payment-request/`, data),

  uploadBankSlip: (projectId, file, clientNotes = '') => {
    const formData = new FormData();
    formData.append('bank_slip', file);
    if (clientNotes) formData.append('client_notes', clientNotes);
    return axiosClient.post(`/projects/${projectId}/upload-bank-slip/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  approvePayment: (projectId, coordinatorNotes = '') =>
    axiosClient.post(`/projects/${projectId}/approve-payment/`, { coordinator_notes: coordinatorNotes }),

  rejectPayment: (projectId, rejectionReason, coordinatorNotes = '') =>
    axiosClient.post(`/projects/${projectId}/reject-payment/`, { 
      rejection_reason: rejectionReason, 
      coordinator_notes: coordinatorNotes 
    }),

  getPaymentDetails: (projectId) =>
    axiosClient.get(`/projects/${projectId}/payment-details/`),

  startProject: (projectId) =>
    axiosClient.post(`/projects/${projectId}/start-project/`),

  getClientPayments: () =>
    axiosClient.get('/projects/client-payments/'),

  getAgentPayments: () =>
    axiosClient.get('/projects/agent-payments/'),

  recordAgentPayment: (projectId, data) =>
    axiosClient.post(`/projects/${projectId}/record-agent-payment/`, data),

  // Cancellation request endpoints
  requestCancellation: (projectId, reason) =>
    axiosClient.post(`/projects/${projectId}/request-cancellation/`, { reason }),

  getCancellationStatus: (projectId) =>
    axiosClient.get(`/projects/${projectId}/cancellation-status/`),

  getCancellationRequests: (status = 'pending') =>
    axiosClient.get('/projects/cancellation-requests/', { params: { status } }),

  approveCancellation: (requestId, adminRemarks = '') =>
    axiosClient.post(`/projects/cancellation-requests/${requestId}/approve/`, { admin_remarks: adminRemarks }),

  rejectCancellation: (requestId, adminRemarks) =>
    axiosClient.post(`/projects/cancellation-requests/${requestId}/reject/`, { admin_remarks: adminRemarks }),

  // Commission report endpoints
  generateCommissionReport: (projectId) =>
    axiosClient.post(`/projects/${projectId}/generate-commission-report/`),

  sendCommissionReport: (reportId) =>
    axiosClient.post(`/projects/commission-reports/${reportId}/send/`),

  getAgentCommissionReports: () =>
    axiosClient.get('/projects/agent-commission-reports/'),
};

export default projectService;
