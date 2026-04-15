import axiosClient from '../api/axiosClient';

const leaveService = {
  createRequest: (data) =>
    axiosClient.post('/auth/leave-requests/create/', data),

  getMyRequests: () =>
    axiosClient.get('/auth/leave-requests/my/'),

  getAllRequests: () =>
    axiosClient.get('/auth/leave-requests/'),

  updateRequest: (id, data) =>
    axiosClient.patch(`/auth/leave-requests/${id}/update/`, data),

  getStatistics: () =>
    axiosClient.get('/auth/leave-requests/statistics/'),

  getMonthlySummary: (params) =>
    axiosClient.get('/auth/leave-requests/summary/monthly/', { params }),
};

export default leaveService;
