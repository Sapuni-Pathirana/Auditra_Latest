import axiosClient from '../api/axiosClient';

const notificationService = {
  getNotifications: () =>
    axiosClient.get('/valuations/notifications/'),

  getUnreadCount: () =>
    axiosClient.get('/valuations/notifications/unread-count/'),

  markAsRead: (id) =>
    axiosClient.post(`/valuations/notifications/${id}/read/`),

  markAllAsRead: () =>
    axiosClient.post('/valuations/notifications/mark-all-read/'),
};

export default notificationService;
