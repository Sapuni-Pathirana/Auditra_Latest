import { Box, Typography } from '@mui/material';

export default function InfoField({
  label,
  value,
  containerSx,
  labelVariant = 'body2',
  labelSx,
  valueVariant = 'body1',
  valueSx,
  fallback = '-',
}) {
  return (
    <Box sx={containerSx}>
      <Typography variant={labelVariant} sx={labelSx}>
        {label}
      </Typography>
      <Typography variant={valueVariant} sx={valueSx}>
        {value || fallback}
      </Typography>
    </Box>
  );
}
