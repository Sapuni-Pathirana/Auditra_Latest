import Chip from '@mui/material/Chip';
import { capitalize, getPriorityColor } from '../utils/helpers';

export default function PriorityChip({
  priority,
  size = 'small',
  width = 110,
  fontSize = 12,
}) {
  const color = getPriorityColor(priority);

  return (
    <Chip
      label={capitalize(priority)}
      size={size}
      sx={{
        bgcolor: `${color}20`,
        color,
        fontWeight: 600,
        fontSize,
        width,
        justifyContent: 'center',
        border: `1px solid ${color}50`,
      }}
    />
  );
}
