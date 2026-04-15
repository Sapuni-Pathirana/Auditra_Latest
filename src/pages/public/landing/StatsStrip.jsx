import { useState, useEffect, useRef } from 'react';
import { Box, Container, Grid, Typography } from '@mui/material';

const stats = [
    { target: 500, suffix: '+', label: 'Projects Completed' },
    { target: 15, suffix: '+', label: 'Years of Experience' },
    { target: 300, suffix: '+', label: 'Satisfied Clients' },
    { target: 50, suffix: '+', label: 'Professionals' },
];

function useCountUp(target, started, duration = 2000) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!started) return;
        let startTime = null;
        let raf;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // ease-out curve
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) {
                raf = requestAnimationFrame(step);
            }
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [started, target, duration]);

    return count;
}

function StatItem({ target, suffix, label, started }) {
    const count = useCountUp(target, started);

    return (
        <Box sx={{ textAlign: 'center', py: { xs: 2, md: 3 } }}>
            <Typography
                variant="h3"
                sx={{
                    fontWeight: 800,
                    color: '#1565C0',
                    fontSize: { xs: '2rem', md: '2.8rem' },
                    lineHeight: 1,
                    mb: 0.5,
                }}
            >
                {started ? count : 0}{suffix}
            </Typography>
            <Typography
                variant="body2"
                sx={{
                    color: '#64748B',
                    fontWeight: 500,
                    fontSize: { xs: '0.8rem', md: '0.9rem' },
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </Typography>
        </Box>
    );
}

export default function StatsStrip() {
    const [started, setStarted] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let observer;

        // Defer observer setup until first scroll so a page refresh
        // with the section already in the viewport doesn't trigger the count-up.
        const setupObserver = () => {
            observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setStarted(true);
                        observer.disconnect();
                    }
                },
                { threshold: 0.3 }
            );
            observer.observe(el);
        };

        const onScroll = () => {
            window.removeEventListener('scroll', onScroll);
            setupObserver();
        };
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', onScroll);
            if (observer) observer.disconnect();
        };
    }, []);

    return (
        <Box ref={ref} sx={{ py: { xs: 4, md: 5 }, bgcolor: '#F1F5F9' }}>
            <Container maxWidth="lg">
                <Grid container spacing={2} justifyContent="center">
                    {stats.map((stat, i) => (
                        <Grid
                            item
                            xs={6}
                            md={3}
                            key={i}
                            sx={{
                                borderRight: {
                                    xs: i % 2 === 0 ? '1px solid #E2E8F0' : 'none',
                                    md: i < stats.length - 1 ? '1px solid #E2E8F0' : 'none',
                                },
                            }}
                        >
                            <StatItem
                                target={stat.target}
                                suffix={stat.suffix}
                                label={stat.label}
                                started={started}
                            />
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
