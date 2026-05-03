import React from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";


/* ------------------------------------------------------------------ */
/*  Registration type selection card                                    */
/* ------------------------------------------------------------------ */
const TypeCard = ({ icon: Icon, title, description, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: { xs: 2, sm: 2.5 },
      borderRadius: '8px',
      border: '1px solid #E2E8F0',
      borderLeft: '3px solid #1565C0',
      bgcolor: '#fff',
      cursor: 'pointer',
      transition: 'all 0.2s',
      '&:hover': {
        bgcolor: '#F8FAFC',
        borderColor: '#1565C0',
        borderLeftColor: '#1565C0',
        boxShadow: '0 2px 12px rgba(21,101,192,0.08)',
        '& .type-arrow': { opacity: 1, transform: 'translateX(0)' },
      },
    }}
  >
    <Icon sx={{ fontSize: 22, color: '#1565C0', flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="body1"
        sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9rem', lineHeight: 1.3 }}
      >
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.78rem', mt: 0.2 }}>
        {description}
      </Typography>
    </Box>
    <ArrowForward
      className="type-arrow"
      sx={{
        fontSize: 18,
        color: '#1565C0',
        opacity: 0,
        transform: 'translateX(-6px)',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    />
  </Box>
);
export default TypeCard;
