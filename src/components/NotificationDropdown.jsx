import { useState, useEffect, useRef } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, Divider, Button, Chip
} from '@mui/material';
import { Notifications, NotificationsNone, DoneAll } from '@mui/icons-material';
import notificationService from '../services/notificationService';

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
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.count || 0);
    } catch {
      // silently fail
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getNotifications();
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setNotifications(data);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0 ? <Notifications /> : <NotificationsNone />}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 480 } }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAll />} onClick={handleMarkAllRead}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 380, overflow: 'auto' }}>
            {notifications.map((n) => (
              <ListItem
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                sx={{
                  cursor: n.is_read ? 'default' : 'pointer',
                  bgcolor: n.is_read ? 'transparent' : 'action.hover',
                  borderLeft: n.is_read ? 'none' : '3px solid',
                  borderColor: n.notification_type === 'rejection' ? 'error.main' : 'primary.main',
                  '&:hover': { bgcolor: 'action.selected' },
                  py: 1.5,
                  px: 2,
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 700, fontSize: '0.82rem' }}>
                        {n.title}
                      </Typography>
                      <Chip
                        label={n.notification_type === 'rejection' ? 'Rejected' : 'Info'}
                        size="small"
                        color={n.notification_type === 'rejection' ? 'error' : 'primary'}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.4 }}>
                        {n.message}
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
