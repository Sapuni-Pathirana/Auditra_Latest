import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar, Box, Toolbar, IconButton, Typography, Button, Container,
    Stack, useMediaQuery, useTheme, Fade
} from '@mui/material';
import { Menu as MenuIcon, Close, Phone, Email, AccessTime } from '@mui/icons-material';
import logo from '../../../assets/logo.webp';

const navLinks = [
    { label: 'HOME', href: '#hero' },
    { label: 'ABOUT US', href: '#about' },
    { label: 'SERVICES', href: '#services' },
    { label: 'WHY US', href: '#why-us' },
    { label: 'REVIEWS', href: '#reviews' },
    { label: 'CONTACT US', href: '#contact' },
];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id) => {
        setDrawerOpen(false);
        const el = document.querySelector(id);
        if (el) {
            const offset = (id === '#services' || id === '#contact') ? 40 : 80;
            const y = el.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <>
            {/* Top thin bar — contact info */}
            <Box
                sx={{
                    bgcolor: '#F8F9FA',
                    borderBottom: '1px solid #EEEEEE',
                    py: 0.5,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1201,
                    display: { xs: 'none', md: 'block' },
                    transition: 'transform 0.3s',
                    transform: scrolled ? 'translateY(-100%)' : 'translateY(0)',
                }}
            >
                <Container maxWidth="xl">
                    <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={3}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Phone sx={{ fontSize: 14, color: '#1565C0' }} />
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
                                +94 11 234 5678
                            </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Email sx={{ fontSize: 14, color: '#1565C0' }} />
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
                                info@auditra.lk
                            </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AccessTime sx={{ fontSize: 14, color: '#1565C0' }} />
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
                                Mon - Fri: 8:30 AM - 5:30 PM
                            </Typography>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            {/* Main Navbar — frosted glass */}
            <AppBar
                position="fixed"
                elevation={scrolled ? 3 : 0}
                sx={{
                    bgcolor: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    top: scrolled ? 0 : { xs: 0, md: '28px' },
                    transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                    borderBottom: '1px solid #EEEEEE',
                }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ py: 1, minHeight: { xs: 64, md: 72 } }}>
                        {/* Logo */}
                        <Box
                            component="img"
                            src={logo}
                            alt="Auditra"
                            onClick={() => scrollTo('#hero')}
                            sx={{
                                height: { xs: 40, md: 50 },
                                cursor: 'pointer',
                                mr: 4,
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.02)' },
                            }}
                        />

                        {/* Spacer */}
                        <Box sx={{ flexGrow: 1 }} />

                        {/* Desktop Nav Links */}
                        {!isMobile && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {navLinks.map((link) => (
                                    <Button
                                        key={link.label}
                                        onClick={() => scrollTo(link.href)}
                                        sx={{
                                            color: '#333333',
                                            fontWeight: 600,
                                            fontSize: '0.82rem',
                                            textTransform: 'uppercase',
                                            px: 1.8,
                                            py: 1,
                                            letterSpacing: '0.5px',
                                            borderRadius: 0,
                                            position: 'relative',
                                            '&::after': {
                                                content: '""',
                                                position: 'absolute',
                                                bottom: 0,
                                                left: '50%',
                                                width: 0,
                                                height: 2,
                                                bgcolor: '#1565C0',
                                                transition: 'all 0.3s',
                                                transform: 'translateX(-50%)',
                                            },
                                            '&:hover': {
                                                bgcolor: 'transparent',
                                                color: '#1565C0',
                                                '&::after': { width: '80%' },
                                            },
                                        }}
                                    >
                                        {link.label}
                                    </Button>
                                ))}

                                {/* CTA Button */}
                                <Button
                                    onClick={() => navigate('/client-register')}
                                    variant="contained"
                                    disableElevation
                                    sx={{
                                        ml: 2,
                                        bgcolor: '#1565C0',
                                        color: '#fff',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        px: 4,
                                        py: 1.2,
                                        borderRadius: '8px',
                                        fontSize: '0.82rem',
                                        letterSpacing: '1px',
                                        '&:hover': { bgcolor: '#0D47A1' },
                                    }}
                                >
                                    GET QUOTE
                                </Button>
                            </Box>
                        )}

                        {/* Mobile Menu Button */}
                        {isMobile && (
                            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: '#333' }}>
                                <MenuIcon />
                            </IconButton>
                        )}
                    </Toolbar>
                </Container>
            </AppBar>

            {/* Fullscreen Mobile Menu */}
            <Fade in={drawerOpen} timeout={300}>
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1300,
                        bgcolor: '#fff',
                        display: drawerOpen ? 'flex' : 'none',
                        flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <Container maxWidth="xl">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
                            <Box component="img" src={logo} alt="Auditra" sx={{ height: 40 }} />
                            <IconButton
                                onClick={() => setDrawerOpen(false)}
                                sx={{
                                    color: '#333',
                                    border: '1px solid #E2E8F0',
                                    width: 40,
                                    height: 40,
                                    '&:hover': { bgcolor: '#F1F5F9' },
                                }}
                            >
                                <Close />
                            </IconButton>
                        </Box>
                    </Container>

                    {/* Nav Links — centered */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                        {navLinks.map((link) => (
                            <Button
                                key={link.label}
                                onClick={() => scrollTo(link.href)}
                                sx={{
                                    color: '#0F172A',
                                    fontWeight: 600,
                                    fontSize: '1.1rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1.5,
                                    py: 1.5,
                                    px: 4,
                                    borderRadius: '8px',
                                    position: 'relative',
                                    '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: 8,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 0,
                                        height: 2,
                                        bgcolor: '#1565C0',
                                        transition: 'width 0.3s',
                                    },
                                    '&:hover': {
                                        bgcolor: 'transparent',
                                        color: '#1565C0',
                                        '&::after': { width: '60%' },
                                    },
                                }}
                            >
                                {link.label}
                            </Button>
                        ))}

                        {/* CTA */}
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => { setDrawerOpen(false); navigate('/client-register'); }}
                            sx={{
                                mt: 3,
                                bgcolor: '#1565C0',
                                color: '#fff',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                px: 5,
                                py: 1.5,
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                letterSpacing: 1,
                                '&:hover': { bgcolor: '#0D47A1' },
                            }}
                        >
                            GET QUOTE
                        </Button>
                    </Box>

                    {/* Bottom contact strip */}
                    <Box sx={{ borderTop: '1px solid #E2E8F0', py: 2.5 }}>
                        <Stack direction="row" justifyContent="center" spacing={3} flexWrap="wrap">
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Phone sx={{ fontSize: 15, color: '#1565C0' }} />
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
                                    +94 11 234 5678
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Email sx={{ fontSize: 15, color: '#1565C0' }} />
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.75rem' }}>
                                    info@auditra.lk
                                </Typography>
                            </Stack>
                        </Stack>
                    </Box>
                </Box>
            </Fade>
        </>
    );
}
