import { Box, Container, Grid, Typography } from '@mui/material';
import { Phone, Email, LocationOn, AccessTime } from '@mui/icons-material';

const contactInfo = [
    {
        icon: LocationOn,
        title: 'Visit Us',
        lines: ['123 Financial District,', 'Colombo 01, Sri Lanka'],
    },
    {
        icon: Phone,
        title: 'Call Us',
        lines: ['+94 11 234 5678', '+94 77 123 4567'],
    },
    {
        icon: Email,
        title: 'Email Us',
        lines: ['info@auditra.lk', 'support@auditra.lk'],
    },
    {
        icon: AccessTime,
        title: 'Working Hours',
        lines: ['Mon - Fri: 8:30 AM - 5:30 PM', 'Sat: 9:00 AM - 1:00 PM'],
    },
];

export default function ContactSection() {
    return (
        <Box id="contact" sx={{ py: { xs: 5, md: 6 }, bgcolor: '#F1F5F9' }}>
            <Container maxWidth="lg">
                {/* Section Header */}
                <Box sx={{ textAlign: 'center', mb: 5, maxWidth: 600, mx: 'auto' }}>
                    <Typography
                        variant="overline"
                        sx={{ color: '#1565C0', fontWeight: 700, letterSpacing: 2.5, fontSize: '0.8rem' }}
                    >
                        CONTACT US
                    </Typography>
                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 700, color: '#0F172A', mt: 1, mb: 2,
                            fontSize: { xs: '1.8rem', md: '2.4rem' },
                        }}
                    >
                        Get in Touch
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748B', fontSize: '1.05rem', lineHeight: 1.7 }}>
                        Have a question or ready to get started? Reach out to our team
                        through any of the channels below.
                    </Typography>
                </Box>

                {/* Contact Items — centered, no card borders */}
                <Grid container spacing={4}>
                    {contactInfo.map((item, i) => (
                        <Grid item xs={12} sm={6} md={3} key={i}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Box
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: '50%',
                                        bgcolor: '#DBEAFE',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mx: 'auto',
                                        mb: 2,
                                    }}
                                >
                                    <item.icon sx={{ color: '#1565C0', fontSize: 24 }} />
                                </Box>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}
                                >
                                    {item.title}
                                </Typography>
                                {item.lines.map((line, j) => (
                                    <Typography
                                        key={j}
                                        variant="body2"
                                        sx={{ color: '#64748B', lineHeight: 1.7 }}
                                    >
                                        {line}
                                    </Typography>
                                ))}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
