import axiosClient from '../api/axiosClient';

const paymentService = {
  generateSlips: (data) =>
    axiosClient.post('/auth/payment-slips/generate/', data),

  publishSlips: (data) =>
    axiosClient.post('/auth/payment-slips/upload/', data),

  getMySlips: () =>
    axiosClient.get('/auth/payment-slips/my/'),

  getAllSlips: () =>
    axiosClient.get('/auth/payment-slips/'),

  getSlip: (id) =>
    axiosClient.get(`/auth/payment-slips/${id}/`),

  updateSlip: (id, data) =>
    axiosClient.patch(`/auth/payment-slips/${id}/`, data),

  deleteSlip: (id) =>
    axiosClient.delete(`/auth/payment-slips/${id}/`),

  uploadOvertime: (slipId, data) =>
    axiosClient.post(`/auth/payment-slips/${slipId}/upload-overtime/`, data),

  uploadAllOvertime: (data) =>
    axiosClient.post('/auth/payment-slips/upload-all-overtime/', data),

  syncOvertime: (data) =>
    axiosClient.post('/auth/payment-slips/sync-overtime/', data),
};

export default paymentService;
