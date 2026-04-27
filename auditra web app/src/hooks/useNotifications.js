import { useCallback, useState } from 'react';
import notificationService from '../services/notificationService';

export const SEVERITY_COLOR = { error: 'error', warning: 'warning', info: 'info', success: 'success' };

export function formatNotificationTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.count || 0);
    } catch {
      // no-op to keep badge resilient
    }
  }, []);

  const fetchNotifications = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications(params);
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setNotifications(data);
      return data;
    } catch {
      setNotifications([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      return true;
    } catch {
      return false;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      return true;
    } catch {
      return false;
    }
  }, []);

  const prependNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev.slice(0, 99)]);
    setUnreadCount((count) => count + 1);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    fetchUnreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    prependNotification,
  };
}
