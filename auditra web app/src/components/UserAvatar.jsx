import { Avatar, Tooltip } from '@mui/material';

/**
 * Unified user avatar — uses profile_image_url if present, falls back to initials.
 * Props:
 *   user: { first_name, last_name, username, profile_image_url }
 *   size: number (px, default 36)
 *   showTooltip: bool (default false)
 */
export default function UserAvatar({ user, size = 36, showTooltip = false, sx = {} }) {
  if (!user) return null;

  const name = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.username || '?';

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const imageUrl = user.profile_image_url || null;

  const avatar = (
    <Avatar
      src={imageUrl}
      alt={name}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        bgcolor: !imageUrl ? stringToColor(name) : undefined,
        cursor: 'default',
        ...sx,
      }}
    >
      {!imageUrl && initials}
    </Avatar>
  );

  if (showTooltip) {
    return <Tooltip title={name}>{avatar}</Tooltip>;
  }
  return avatar;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 45%, 45%)`;
}
