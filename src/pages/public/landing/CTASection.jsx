import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function CTASection() {
    const navigate = useNavigate();

    return (
        <Box
            id="cta"
            sx={{
                py: { xs: 5, md: 6 },
                bgcolor: '#1565C0',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <Typography
                    variant="h3"
                    sx={{
                        color: '#fff', fontWeight: 700, mb: 2,
                        fontSize: { xs: '1.8rem', md: '2.6rem' },
                    }}
                >
                    Ready to Elevate Your Business?
                </Typography>
                <Typography
                    variant="h6"
                    sx={{
                        color: 'rgba(255,255,255,0.8)', fontWeight: 400, mb: 5,
                        fontSize: { xs: '1rem', md: '1.15rem' }, maxWidth: 560, mx: 'auto', lineHeight: 1.7,
                    }}
                >
                    Join hundreds of satisfied clients who trust Auditra for precision auditing,
                    expert advisory, and reliable financial solutions.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                    <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForward />}
                        onClick={() => navigate('/client-register')}
                        sx={{
                            bgcolor: '#fff',
                            color: '#1565C0',
                            fontWeight: 700,
                            textTransform: 'none',
                            px: 5,
                            py: 1.5,
                            borderRadius: '8px',
                            fontSize: '1rem',
                            '&:hover': { bgcolor: '#F1F5F9', transform: 'translateY(-2px)' },
                            transition: 'all 0.3s',
                        }}
                    >
                        Get Quote
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => navigate('/employee-register')}
                        sx={{
                            color: '#fff',
                            borderColor: 'rgba(255,255,255,0.4)',
                            fontWeight: 600,
                            textTransform: 'none',
                            px: 5,
                            py: 1.5,
                            borderRadius: '8px',
                            fontSize: '1rem',
                            '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
                        }}
                    >
                        Join Our Team
                    </Button>
                </Stack>
            </Container>
        </Box>
    );
}
