import { Card, Typography, Box, useTheme, alpha } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function StatsCard({ title, value, icon: Icon, color, subtitle, onClick }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolvedColor = color || theme.palette.primary.main;
  const clickable = !!onClick;

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        border: isDark ? `1px solid ${alpha(resolvedColor, 0.2)}` : `1px solid ${theme.palette.divider}`,
        borderBottom: `3px solid ${resolvedColor}`,
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        '&:hover': clickable ? {
          transform: 'translateY(-4px)',
          boxShadow: isDark
            ? `0 12px 32px ${alpha(resolvedColor, 0.25)}`
            : `0 12px 32px ${alpha(resolvedColor, 0.18)}`,
          borderColor: alpha(resolvedColor, 0.4),
          '& .stats-arrow': { opacity: 1, transform: 'translateX(0)' },
          '& .stats-icon-bg': {
            transform: 'scale(1.08)',
          },
        } : {},
      }}
    >
      {/* Watermark icon in background */}
      {Icon && (
        <Box sx={{
          position: 'absolute',
          top: -12,
          right: -12,
          opacity: isDark ? 0.06 : 0.05,
          pointerEvents: 'none',
        }}>
          <Icon sx={{ fontSize: 120, color: resolvedColor }} />
        </Box>
      )}

      <Box sx={{ p: { xs: 2, sm: 2.5 }, position: 'relative', zIndex: 1 }}>
        {/* Top row: icon + arrow */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          {Icon && (
            <Box
              className="stats-icon-bg"
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDark
                  ? `linear-gradient(135deg, ${alpha(resolvedColor, 0.2)} 0%, ${alpha(resolvedColor, 0.1)} 100%)`
                  : `linear-gradient(135deg, ${alpha(resolvedColor, 0.15)} 0%, ${alpha(resolvedColor, 0.06)} 100%)`,
                transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <Icon sx={{ fontSize: 24, color: resolvedColor }} />
            </Box>
          )}
          {clickable && (
            <Box
              className="stats-arrow"
              sx={{
                opacity: 0,
                transform: 'translateX(-8px)',
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                width: 28,
                height: 28,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(resolvedColor, 0.1),
              }}
            >
              <ArrowForwardIcon sx={{ fontSize: 16, color: resolvedColor }} />
            </Box>
          )}
        </Box>

        {/* Value */}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: isDark ? theme.palette.text.primary : resolvedColor,
            lineHeight: 1,
            mb: 0.5,
            fontSize: { xs: '1.75rem', sm: '2rem' },
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </Typography>

        {/* Title */}
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
            fontSize: '0.8rem',
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              mt: 0.25,
              display: 'block',
              fontSize: '0.7rem',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
