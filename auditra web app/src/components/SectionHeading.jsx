import React from "react";
import { Box, Typography } from "@mui/material";

/* ------------------------------------------------------------------ */
/*  Section heading with blue underline                                */
/* ------------------------------------------------------------------ */
const SectionHeading = ({ children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography
      variant="subtitle1"
      sx={{
        fontWeight: 700,
        color: '#1565C0',
        pb: 1,
        position: 'relative',
        display: 'inline-block',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 40,
          height: 3,
          bgcolor: '#1565C0',
          borderRadius: 1,
        },
      }}
    >
      {children}
    </Typography>
  </Box>
);

export default SectionHeading;