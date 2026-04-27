import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton, Badge, Popover, Box, Typography, Divider, Button, Snackbar, Alert,
} from '@mui/material';
import { Notifications, NotificationsNone, DoneAll, OpenInNew } from '@mui/icons-material';
import realtimeSocket from '../services/realtimeSocket';
import NotificationList from './NotificationList';
import useNotifications, { SEVERITY_COLOR } from '../hooks/useNotifications';

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [toast, setToast] = useState(null);
  const {
    notifications,
    unreadCount,
    fetchUnreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    prependNotification,
  } = useNotifications();

  useEffect(() => {
    fetchUnreadCount();
    // Fallback polling every 2 min
    const poll = setInterval(fetchUnreadCount, 120_000);
    return () => clearInterval(poll);
  }, [fetchUnreadCount]);

  // Live WebSocket notifications
  useEffect(() => {
    const unsub = realtimeSocket.subscribe((msg) => {
      if (msg.type === 'notification') {
        const notification = {
          id: msg.id,
          title: msg.title,
          message: msg.message,
          category: msg.category,
          severity: msg.severity || 'info',
          action_url: msg.action_url,
          created_at: msg.created_at,
          is_read: false,
        };
        prependNotification(notification);
        setToast(notification);
      }
    });
    return unsub;
  }, [prependNotification]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications({ unread: false });
  };

  const open = Boolean(anchorEl);

  return (
    <>
      {/* Toast snackbar for live notifications */}
      {toast && (
        <Snackbar
          open
          autoHideDuration={5000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            severity={SEVERITY_COLOR[toast.severity] || 'info'}
            onClose={() => setToast(null)}
            variant="filled"
            action={
              toast.action_url ? (
                <Button color="inherit" size="small" onClick={() => { setToast(null); navigate(toast.action_url); }}>
                  View
                </Button>
              ) : null
            }
          >
            <strong>{toast.title}</strong>
            {toast.message && <Typography variant="caption" display="block">{toast.message.slice(0, 80)}</Typography>}
          </Alert>
        </Snackbar>
      )}

      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0 ? <Notifications /> : <NotificationsNone />}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 400, maxHeight: 500 } }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notifications</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {unreadCount > 0 && (
              <Button size="small" startIcon={<DoneAll />} onClick={markAllRead} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Mark all read
              </Button>
            )}
            <Button size="small" startIcon={<OpenInNew />} onClick={() => { setAnchorEl(null); navigate('/dashboard/notifications'); }} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              View all
            </Button>
          </Box>
        </Box>
        <Divider />

        <NotificationList
          notifications={notifications}
          dense
          truncateMessage
          onNotificationClick={(n) => {
            if (!n.is_read) markRead(n.id);
            if (n.action_url) {
              setAnchorEl(null);
              navigate(n.action_url);
            }
          }}
          emptyMessage="No notifications"
        />
      </Popover>
    </>
  );
}
