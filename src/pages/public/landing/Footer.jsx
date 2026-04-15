import { Box, Container, Grid, Typography, Stack, IconButton, Divider, Link as MuiLink } from '@mui/material';
import { Phone, Email, LocationOn, AccessTime, Facebook, LinkedIn, Instagram, Twitter } from '@mui/icons-material';
import logo from '../../../assets/logo.webp';

const quickLinks = [
    { label: 'Home', href: '#hero' },
    { label: 'About Us', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Reviews', href: '#reviews' },
    { label: 'Contact', href: '#contact' },
];

const serviceLinks = [
    { label: 'Financial Auditing', href: '#services' },
    { label: 'Tax Advisory', href: '#services' },
    { label: 'Business Consulting', href: '#services' },
    { label: 'Legal Compliance', href: '#services' },
    { label: 'Asset Valuation', href: '#services' },
    { label: 'IT Auditing', href: '#services' },
];

const scrollTo = (id) => {
    const el = document.querySelector(id);
    if (el) {
        const offset = (id === '#services' || id === '#contact') ? 40 : 80;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
};

const linkSx = {
    color: '#64748B',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': { color: '#1565C0', pl: 0.5 },
};

const headingSx = {
    fontWeight: 700,
    color: '#0F172A',
    mb: 2.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    position: 'relative',
    pb: 1.5,
    '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 30,
        height: 2,
        bgcolor: '#1565C0',
        borderRadius: 1,
    },
};

export default function Footer() {
    return (
        <Box component="footer" sx={{ bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
            {/* Main Footer */}
            <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 4, md: 5 } }}>
                <Grid container spacing={{ xs: 4, md: 6 }}>
                    {/* Company Info */}
                    <Grid item xs={12} md={4}>
                        <Box
                            component="img"
                            src={logo}
                            alt="Auditra"
                            sx={{
                                height: 42,
                                mb: 2.5,
                            }}
                        />
                        <Typography
                            variant="body2"
                            sx={{ color: '#64748B', lineHeight: 1.8, mb: 3, maxWidth: 300 }}
                        >
                            Delivering comprehensive audit, tax advisory, and valuation services
                            across Sri Lanka. Trusted by businesses for precision, integrity,
                            and strategic insight for over 15 years.
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {[
                                { Icon: Facebook, label: 'Facebook' },
                                { Icon: Twitter, label: 'Twitter' },
                                { Icon: LinkedIn, label: 'LinkedIn' },
                                { Icon: Instagram, label: 'Instagram' },
                            ].map(({ Icon, label }) => (
                                <IconButton
                                    key={label}
                                    size="small"
                                    aria-label={label}
                                    sx={{
                                        color: '#64748B',
                                        border: '1px solid #E2E8F0',
                                        bgcolor: '#fff',
                                        width: 36,
                                        height: 36,
                                        '&:hover': {
                                            color: '#fff',
                                            bgcolor: '#1565C0',
                                            borderColor: '#1565C0',
                                        },
                                        transition: 'all 0.3s',
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18 }} />
                                </IconButton>
                            ))}
                        </Stack>
                    </Grid>

                    {/* Quick Links */}
                    <Grid item xs={6} sm={4} md={2}>
                        <Typography variant="subtitle2" sx={headingSx}>
                            Quick Links
                        </Typography>
                        <Stack spacing={1.5}>
                            {quickLinks.map((link) => (
                                <MuiLink
                                    key={link.label}
                                    underline="none"
                                    onClick={() => scrollTo(link.href)}
                                    sx={linkSx}
                                >
                                    {link.label}
                                </MuiLink>
                            ))}
                        </Stack>
                    </Grid>

                    {/* Services Links */}
                    <Grid item xs={6} sm={4} md={3}>
                        <Typography variant="subtitle2" sx={headingSx}>
                            Our Services
                        </Typography>
                        <Stack spacing={1.5}>
                            {serviceLinks.map((link) => (
                                <MuiLink
                                    key={link.label}
                                    underline="none"
                                    onClick={() => scrollTo(link.href)}
                                    sx={linkSx}
                                >
                                    {link.label}
                                </MuiLink>
                            ))}
                        </Stack>
                    </Grid>

                    {/* Contact Info */}
                    <Grid item xs={12} sm={4} md={3}>
                        <Typography variant="subtitle2" sx={headingSx}>
                            Get In Touch
                        </Typography>
                        <Stack spacing={1.8}>
                            {[
                                { Icon: LocationOn, text: '123 Financial District, Colombo 01, Sri Lanka' },
                                { Icon: Phone, text: '+94 11 234 5678' },
                                { Icon: Email, text: 'info@auditra.lk' },
                                { Icon: AccessTime, text: 'Mon – Fri: 8:30 AM – 5:30 PM' },
                            ].map(({ Icon, text }, i) => (
                                <Stack key={i} direction="row" spacing={1.2} alignItems="center">
                                    <Icon sx={{ color: '#1565C0', fontSize: 17 }} />
                                    <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.85rem' }}>
                                        {text}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Grid>
                </Grid>
            </Container>

            {/* Bottom Bar */}
            <Box sx={{ bgcolor: '#F1F5F9' }}>
                <Container maxWidth="lg">
                    <Divider sx={{ borderColor: '#E2E8F0' }} />
                    <Box sx={{ py: 2.5, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                            &copy; {new Date().getFullYear()} Auditra (Pvt) Ltd. All rights reserved.
                        </Typography>
                    </Box>
                </Container>
            </Box>
        </Box>
    );
}
