import { useState, useEffect } from 'react';
import {
  Box, Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Paper,
} from '@mui/material';
import { DoneAll } from '@mui/icons-material';
import NotificationList from '../../components/NotificationList';
import useNotifications from '../../hooks/useNotifications';

export default function NotificationsPage() {
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    const params = {};
    if (category) params.category = category;
    if (unreadOnly) params.unread = true;
    fetchNotifications(params);
  }, [category, unreadOnly, fetchNotifications]);

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
        <NotificationList
          notifications={notifications}
          showUnreadBadge
          onNotificationClick={(n) => {
            if (!n.is_read) markRead(n.id);
          }}
          emptyMessage="No notifications to display"
        />
      </Paper>
    </Box>
  );
}
