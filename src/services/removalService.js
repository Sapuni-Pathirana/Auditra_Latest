import axiosClient from '../api/axiosClient';

const removalService = {
  createRequest: (data) =>
    axiosClient.post('/auth/removal-requests/create/', data),

  createRemovalRequest: (data) =>
    axiosClient.post('/auth/removal-requests/create/', data),

  getAllRequests: () =>
    axiosClient.get('/auth/removal-requests/'),

  getRemovalRequests: () =>
    axiosClient.get('/auth/removal-requests/'),

  approveRequest: (requestId) =>
    axiosClient.post(`/auth/removal-requests/${requestId}/approve/`),

  rejectRequest: (requestId) =>
    axiosClient.post(`/auth/removal-requests/${requestId}/reject/`),
};

export default removalService;
