import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, Divider, Button, Chip, Snackbar, Alert,
} from '@mui/material';
import { Notifications, NotificationsNone, DoneAll, OpenInNew } from '@mui/icons-material';
import axiosClient from '../api/axiosClient';
import realtimeSocket from '../services/realtimeSocket';

const SEVERITY_COLOR = { error: 'error', warning: 'warning', info: 'info', success: 'success' };

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await axiosClient.get('/notifications/unread-count/');
      setUnreadCount(res.data.count || 0);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axiosClient.get('/notifications/?unread=false');
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setNotifications(data);
    } catch {}
  }, []);

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
        const n = {
          id: msg.id,
          title: msg.title,
          message: msg.message,
          category: msg.category,
          severity: msg.severity || 'info',
          action_url: msg.action_url,
          created_at: msg.created_at,
          is_read: false,
        };
        setNotifications((prev) => [n, ...prev.slice(0, 99)]);
        setUnreadCount((c) => c + 1);
        setToast(n);
      }
    });
    return unsub;
  }, []);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications();
  };

  const handleMarkRead = async (id) => {
    try {
      await axiosClient.patch(`/notifications/${id}/read/`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await axiosClient.post('/notifications/mark-all-read/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
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
              <Button size="small" startIcon={<DoneAll />} onClick={handleMarkAllRead} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Mark all read
              </Button>
            )}
            <Button size="small" startIcon={<OpenInNew />} onClick={() => { setAnchorEl(null); navigate('/dashboard/notifications'); }} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              View all
            </Button>
          </Box>
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {notifications.map((n) => (
              <ListItem
                key={n.id}
                onClick={() => { if (!n.is_read) handleMarkRead(n.id); if (n.action_url) { setAnchorEl(null); navigate(n.action_url); } }}
                sx={{
                  cursor: 'pointer',
                  bgcolor: n.is_read ? 'transparent' : 'action.hover',
                  borderLeft: '3px solid',
                  borderColor: n.is_read ? 'transparent' : (SEVERITY_COLOR[n.severity] ? `${SEVERITY_COLOR[n.severity]}.main` : 'primary.main'),
                  '&:hover': { bgcolor: 'action.selected' },
                  py: 1.5, px: 2,
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 700, fontSize: '0.82rem' }}>
                        {n.title}
                      </Typography>
                      <Chip
                        label={n.category}
                        size="small"
                        color={SEVERITY_COLOR[n.severity] || 'default'}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.4 }}>
                        {n.message?.slice(0, 100)}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                        {timeAgo(n.created_at)}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
