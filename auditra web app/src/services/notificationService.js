import axiosClient from '../api/axiosClient';

const notificationService = {
  getNotifications: (params = {}) =>
    axiosClient.get('/notifications/', { params }),

  getUnreadCount: () =>
    axiosClient.get('/notifications/unread-count/'),

  markAsRead: (id) =>
    axiosClient.patch(`/notifications/${id}/read/`),

  markAllAsRead: () =>
    axiosClient.post('/notifications/mark-all-read/'),
};

export default notificationService;
