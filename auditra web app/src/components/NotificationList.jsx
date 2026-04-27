import {
  Box, Typography, List, ListItem, ListItemText, Divider, Chip,
} from '@mui/material';
import { NotificationsNone } from '@mui/icons-material';
import { formatNotificationTimeAgo, SEVERITY_COLOR } from '../hooks/useNotifications';

export default function NotificationList({
  notifications,
  onNotificationClick,
  dense = false,
  showUnreadBadge = false,
  truncateMessage = false,
  emptyMessage = 'No notifications',
}) {
  if (!notifications.length) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <List sx={{ p: 0, maxHeight: dense ? 400 : undefined, overflow: dense ? 'auto' : undefined }}>
      {notifications.map((n, i) => (
        <Box key={n.id}>
          <ListItem
            onClick={() => onNotificationClick?.(n)}
            sx={{
              cursor: n.is_read ? 'default' : 'pointer',
              bgcolor: n.is_read ? 'transparent' : 'action.hover',
              borderLeft: dense ? '3px solid' : '4px solid',
              borderColor: n.is_read ? 'transparent' : `${SEVERITY_COLOR[n.severity] || 'primary'}.main`,
              '&:hover': { bgcolor: 'action.selected' },
              py: dense ? 1.5 : 2,
              px: dense ? 2 : 2.5,
            }}
          >
            <ListItemText
              primary={(
                <Box sx={{ display: 'flex', justifyContent: dense ? 'space-between' : undefined, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 700, fontSize: dense ? '0.82rem' : undefined, flex: dense ? undefined : 1 }}>
                    {n.title}
                  </Typography>
                  <Chip label={n.category} size="small" color={SEVERITY_COLOR[n.severity] || 'default'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                  {showUnreadBadge && !n.is_read && <Chip label="New" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />}
                </Box>
              )}
              secondary={(
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.4 }}>
                    {truncateMessage ? n.message?.slice(0, 100) : n.message}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                    {formatNotificationTimeAgo(n.created_at)}
                  </Typography>
                </>
              )}
            />
          </ListItem>
          {!dense && i < notifications.length - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );
}
