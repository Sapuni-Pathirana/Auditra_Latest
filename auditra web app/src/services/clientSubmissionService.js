import axiosClient from '../api/axiosClient';

const clientSubmissionService = {
  getSubmissions: (params = {}) =>
    axiosClient.get('/auth/client-submissions/', { params }),

  updateSubmission: (submissionId, data) =>
    axiosClient.patch(`/auth/client-submissions/${submissionId}/`, data),

  approveSubmission: (submissionId) =>
    axiosClient.post(`/auth/client-submissions/${submissionId}/approve/`),

  deleteSubmission: (submissionId) =>
    axiosClient.delete(`/auth/client-submissions/${submissionId}/`),

  getCoordinators: () =>
    axiosClient.get('/auth/coordinators/'),

  assignCoordinator: (submissionId, coordinatorId) =>
    axiosClient.post(`/auth/client-submissions/${submissionId}/assign-coordinator/`, {
      coordinator_id: coordinatorId,
    }),

  acceptAssignment: (submissionId) =>
    axiosClient.post(`/auth/client-submissions/${submissionId}/accept/`),

  rejectAssignment: (submissionId, rejectionReason) =>
    axiosClient.post(`/auth/client-submissions/${submissionId}/reject/`, {
      rejection_reason: rejectionReason,
    }),
};

export default clientSubmissionService;
