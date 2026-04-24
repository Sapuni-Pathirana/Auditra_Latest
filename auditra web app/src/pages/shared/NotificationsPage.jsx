import { useState, useEffect } from 'react';
import {
  Box, Typography, List, ListItem, ListItemText, Divider, Chip,
  Button, Select, MenuItem, FormControl, InputLabel, Paper,
} from '@mui/material';
import { DoneAll, NotificationsNone } from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

const SEVERITY_COLOR = { error: 'error', warning: 'warning', info: 'info', success: 'success' };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      if (unreadOnly) params.unread = true;
      const res = await axiosClient.get('/notifications/', { params });
      setNotifications(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [category, unreadOnly]);

  const markRead = async (id) => {
    await axiosClient.patch(`/notifications/${id}/read/`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await axiosClient.post('/notifications/mark-all-read/');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Notifications</Typography>
        <Button startIcon={<DoneAll />} onClick={markAllRead} variant="outlined" size="small">
          Mark all read
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {['project', 'valuation', 'chat', 'visit', 'payment', 'account', 'leave', 'general'].map((c) => (
              <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant={unreadOnly ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setUnreadOnly((v) => !v)}
        >
          {unreadOnly ? 'Unread only' : 'Show all'}
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {notifications.length === 0 && !loading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary" mt={1}>No notifications to display</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {notifications.map((n, i) => (
              <Box key={n.id}>
                <ListItem
                  onClick={() => !n.is_read && markRead(n.id)}
                  sx={{
                    cursor: n.is_read ? 'default' : 'pointer',
                    bgcolor: n.is_read ? 'transparent' : 'action.hover',
                    borderLeft: '4px solid',
                    borderColor: n.is_read ? 'transparent' : `${SEVERITY_COLOR[n.severity] || 'primary'}.main`,
                    '&:hover': { bgcolor: 'action.selected' },
                    py: 2, px: 2.5,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={n.is_read ? 400 : 700} sx={{ flex: 1 }}>
                          {n.title}
                        </Typography>
                        <Chip label={n.category} size="small" color={SEVERITY_COLOR[n.severity] || 'default'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                        {!n.is_read && <Chip label="New" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.5 }}>
                          {n.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {i < notifications.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
