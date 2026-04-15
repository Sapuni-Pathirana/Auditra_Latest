import { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, IconButton, Stack } from '@mui/material';
import { ArrowForward, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import hero1 from '../../../assets/hero1.webp';
import hero2 from '../../../assets/hero2.webp';
import hero3 from '../../../assets/hero3.webp';

const slides = [
    {
        heading: 'Your Trusted Partner in\nAuditing',
        subtitle: 'Delivering comprehensive audit and assurance services across Sri Lanka',
        primaryBtn: { label: 'Our Services', link: '#services' },
        secondaryBtn: { label: 'Get Quote', link: '/client-register' },
        image: hero1,
    },
    {
        heading: 'Precision.\nIntegrity.\nExcellence.',
        subtitle: 'Over 15 years of professional auditing expertise you can rely on',
        primaryBtn: { label: 'About Us', link: '#about' },
        secondaryBtn: { label: 'Get Quote', link: '/client-register' },
        image: hero2,
    },
    {
        heading: 'Beyond Numbers —\nStrategic Insight',
        subtitle: 'Project valuation, compliance, and advisory that drives real results',
        primaryBtn: { label: 'Get in Touch', link: '#contact' },
        secondaryBtn: { label: 'Get Quote', link: '/client-register' },
        image: hero3,
    },
];

export default function HeroSection() {
    const [current, setCurrent] = useState(0);
    const [animating, setAnimating] = useState(false);
    const navigate = useNavigate();

    const goTo = useCallback((index) => {
        if (animating) return;
        setAnimating(true);
        setCurrent(index);
        setTimeout(() => setAnimating(false), 700);
    }, [animating]);

    const next = useCallback(() => {
        goTo((current + 1) % slides.length);
    }, [current, goTo]);

    const prev = useCallback(() => {
        goTo((current - 1 + slides.length) % slides.length);
    }, [current, goTo]);

    // Auto-advance
    useEffect(() => {
        const timer = setInterval(next, 5000);
        return () => clearInterval(timer);
    }, [next]);

    const handleCTA = (link) => {
        if (link.startsWith('#')) {
            const el = document.querySelector(link);
            if (el) {
                const offset = (link === '#services' || link === '#contact') ? 40 : 80;
                const y = el.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        } else {
            navigate(link);
        }
    };

    const slide = slides[current];

    return (
        <Box
            id="hero"
            sx={{
                position: 'relative',
                height: { xs: '70vh', md: '78vh' },
                minHeight: 480,
                overflow: 'hidden',
                mt: { xs: '64px', md: '100px' }, // offset for fixed navbar + top bar
                pb: { xs: '60px', md: '80px' }, // extra space for angled bottom
            }}
        >
            {/* Slides */}
            {slides.map((s, i) => (
                <Box
                    key={i}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${s.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: i === current ? 1 : 0,
                        transition: 'opacity 0.7s ease-in-out',
                        zIndex: i === current ? 1 : 0,
                    }}
                />
            ))}

            {/* Dark overlay for text readability */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    background: 'linear-gradient(135deg, rgba(13,71,161,0.50) 0%, rgba(21,101,192,0.35) 50%, rgba(13,71,161,0.45) 100%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Content */}
            <Container
                maxWidth="lg"
                sx={{
                    position: 'relative',
                    zIndex: 5,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    py: 4,
                }}
            >
                <Box
                    sx={{
                        maxWidth: 650,
                    }}
                >
                    {/* Badge */}
                    <Box
                        sx={{
                            display: 'inline-block',
                            border: '1.5px solid rgba(255,255,255,0.5)',
                            borderRadius: 0.5,
                            px: 2,
                            py: 0.5,
                            mb: 3,
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'rgba(255,255,255,0.9)',
                                fontWeight: 600,
                                letterSpacing: 2.5,
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                            }}
                        >
                            AUDITRA SRI LANKA
                        </Typography>
                    </Box>

                    {/* Heading */}
                    <Typography
                        variant="h1"
                        sx={{
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: { xs: '2rem', sm: '2.8rem', md: '3.5rem' },
                            lineHeight: 1.2,
                            mb: 3,
                            whiteSpace: 'pre-line',
                            textShadow: '0 2px 20px rgba(0,0,0,0.1)',
                        }}
                    >
                        {slide.heading}
                    </Typography>

                    {/* Subtitle */}
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: { xs: '0.95rem', md: '1.1rem' },
                            lineHeight: 1.7,
                            maxWidth: 520,
                            mb: 4,
                        }}
                    >
                        {slide.subtitle}
                    </Typography>

                    {/* CTA Buttons */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button
                            variant="contained"
                            size="large"
                            endIcon={<ArrowForward />}
                            onClick={() => handleCTA(slide.primaryBtn.link)}
                            sx={{
                                bgcolor: '#fff',
                                color: '#1565C0',
                                fontWeight: 700,
                                textTransform: 'none',
                                px: 4,
                                py: 1.4,
                                borderRadius: '8px',
                                fontSize: '1rem',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                                '&:hover': {
                                    bgcolor: '#F1F5F9',
                                    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                                    transform: 'translateY(-2px)',
                                },
                                transition: 'all 0.3s',
                            }}
                        >
                            {slide.primaryBtn.label}
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={() => handleCTA(slide.secondaryBtn.link)}
                            sx={{
                                color: '#fff',
                                borderColor: '#fff',
                                borderWidth: 2,
                                fontWeight: 700,
                                textTransform: 'none',
                                px: 4,
                                py: 1.4,
                                borderRadius: '8px',
                                fontSize: '1rem',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.15)',
                                    borderColor: '#fff',
                                    borderWidth: 2,
                                },
                                transition: 'all 0.3s',
                            }}
                        >
                            {slide.secondaryBtn.label}
                        </Button>
                    </Stack>
                </Box>
            </Container>

            {/* Navigation Arrows — hidden on mobile to avoid overlap */}
            <IconButton
                onClick={prev}
                sx={{
                    position: 'absolute',
                    left: 24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    display: { xs: 'none', md: 'flex' },
                    color: 'rgba(255,255,255,0.7)',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    width: 48,
                    height: 48,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' },
                    transition: 'all 0.3s',
                }}
            >
                <ChevronLeft sx={{ fontSize: 28 }} />
            </IconButton>
            <IconButton
                onClick={next}
                sx={{
                    position: 'absolute',
                    right: 24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    display: { xs: 'none', md: 'flex' },
                    color: 'rgba(255,255,255,0.7)',
                    bgcolor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    width: 48,
                    height: 48,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' },
                    transition: 'all 0.3s',
                }}
            >
                <ChevronRight sx={{ fontSize: 28 }} />
            </IconButton>

            {/* Pagination Dots */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: { xs: 70, md: 90 },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.2,
                }}
            >
                {slides.map((_, i) => (
                    <Box
                        key={i}
                        onClick={() => goTo(i)}
                        sx={{
                            width: i === current ? 28 : 10,
                            height: 10,
                            borderRadius: 5,
                            bgcolor: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            transition: 'all 0.35s ease',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.7)' },
                        }}
                    />
                ))}
            </Box>

            {/* Angled / Diagonal bottom edge */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -1,
                    left: 0,
                    width: '100%',
                    zIndex: 10,
                    lineHeight: 0,
                }}
            >
                <svg
                    viewBox="0 0 1440 80"
                    preserveAspectRatio="none"
                    style={{ display: 'block', width: '100%', height: '60px' }}
                >
                    <polygon points="0,80 1440,0 1440,80" fill="#F1F5F9" />
                </svg>
            </Box>
        </Box>
    );
}
