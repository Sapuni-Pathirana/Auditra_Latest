import { Box, Container, Grid, Typography } from '@mui/material';
import {
    VerifiedUser, Gavel, TrendingUp, Groups, Description, Security,
} from '@mui/icons-material';

const features = [
    { icon: VerifiedUser, title: 'Certified Professionals', desc: 'Team of qualified and experienced audit professionals.' },
    { icon: Gavel, title: 'Regulatory Compliance', desc: 'Full adherence to Sri Lankan and international standards.' },
    { icon: TrendingUp, title: 'Strategic Advisory', desc: 'Insights that drive growth and informed decision-making.' },
    { icon: Groups, title: 'Client Focused', desc: 'Tailored solutions built around your unique business needs.' },
    { icon: Description, title: 'Transparent Reporting', desc: 'Clear, accurate, and timely reporting you can trust.' },
    { icon: Security, title: 'Data Security', desc: 'Your information is protected with industry-best practices.' },
];

export default function AboutSection() {
    return (
        <Box id="about" sx={{ py: { xs: 5, md: 6 }, bgcolor: '#FFFFFF' }}>
            <Container maxWidth="lg">
                <Grid container spacing={6} alignItems="center">
                    {/* Left — Text */}
                    <Grid item xs={12} md={5}>
                        <Typography
                            variant="overline"
                            sx={{ color: '#1565C0', fontWeight: 700, letterSpacing: 2.5, fontSize: '0.8rem' }}
                        >
                            ABOUT US
                        </Typography>

                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 700,
                                color: '#0F172A',
                                mt: 1,
                                mb: 3,
                                fontSize: { xs: '1.8rem', md: '2.4rem' },
                                lineHeight: 1.25,
                            }}
                        >
                            Your Trusted Partner in Financial Excellence
                        </Typography>

                        <Typography
                            variant="body1"
                            sx={{ color: '#64748B', lineHeight: 1.8, fontSize: '1.05rem', mb: 3 }}
                        >
                            At Auditra, we deliver more than numbers — we provide clarity, insight,
                            and confidence. Our team of seasoned professionals combines cutting-edge
                            technology with deep industry knowledge to ensure accuracy, compliance,
                            and strategic value for every engagement.
                        </Typography>

                        {/* Experience badge inline */}
                        <Box
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 1.5,
                                bgcolor: '#EFF6FF',
                                border: '1px solid #DBEAFE',
                                borderRadius: '16px',
                                px: 3,
                                py: 1.5,
                            }}
                        >
                            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1565C0' }}>
                                15+
                            </Typography>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                                    Years of Trust
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748B' }}>
                                    Serving businesses across Sri Lanka
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Right — Feature cards grid */}
                    <Grid item xs={12} md={7}>
                        <Grid container spacing={2}>
                            {features.map((feature, i) => (
                                <Grid item xs={12} sm={6} key={i}>
                                    <Box
                                        sx={{
                                            p: 2.5,
                                            borderRadius: '16px',
                                            bgcolor: '#F8FAFC',
                                            border: '1px solid #E2E8F0',
                                            height: '100%',
                                            transition: 'all 0.3s',
                                            '&:hover': {
                                                bgcolor: '#EFF6FF',
                                                borderColor: '#DBEAFE',
                                                boxShadow: '0 4px 16px rgba(21,101,192,0.08)',
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: '12px',
                                                bgcolor: '#EFF6FF',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 1.5,
                                            }}
                                        >
                                            <feature.icon sx={{ color: '#1565C0', fontSize: 22 }} />
                                        </Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.5 }}>
                                            {feature.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.5, fontSize: '0.82rem' }}>
                                            {feature.desc}
                                        </Typography>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}
