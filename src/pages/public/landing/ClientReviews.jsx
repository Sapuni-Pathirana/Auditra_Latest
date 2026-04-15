import { Box, Container, Grid, Typography, Divider } from '@mui/material';
import { FormatQuote } from '@mui/icons-material';

const reviews = [
    {
        quote: 'Auditra has been instrumental in streamlining our financial processes. Their attention to detail and professional approach gave us complete confidence in our audit results.',
        name: 'Rajitha Perera',
        company: 'Perera Holdings Ltd.',
    },
    {
        quote: 'The team at Auditra provided exceptional tax advisory services that helped us optimize our financial position significantly. Highly recommended for any business.',
        name: 'Samantha Fernando',
        company: 'Lanka Exports Pvt. Ltd.',
    },
    {
        quote: 'Working with Auditra for our asset valuation was seamless. Their expertise and transparent reporting made the entire process smooth and trustworthy.',
        name: 'Dinesh Jayawardena',
        company: 'Colombo Properties Group',
    },
];

export default function ClientReviews() {
    return (
        <Box id="reviews" sx={{ py: { xs: 5, md: 6 }, bgcolor: '#F1F5F9' }}>
            <Container maxWidth="lg">
                {/* Section Header */}
                <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 640, mx: 'auto' }}>
                    <Typography
                        variant="overline"
                        sx={{ color: '#1565C0', fontWeight: 700, letterSpacing: 2.5, fontSize: '0.8rem' }}
                    >
                        CLIENT REVIEWS
                    </Typography>
                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 700, color: '#0F172A', mt: 1, mb: 2,
                            fontSize: { xs: '1.8rem', md: '2.4rem' },
                        }}
                    >
                        What Our Clients Say
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748B', fontSize: '1.05rem', lineHeight: 1.7 }}>
                        Trusted by businesses across Sri Lanka for precision, integrity, and results.
                    </Typography>
                </Box>

                {/* Reviews Grid */}
                <Grid container spacing={3}>
                    {reviews.map((review, i) => (
                        <Grid item xs={12} md={4} key={i}>
                            <Box
                                sx={{
                                    bgcolor: '#FFFFFF',
                                    borderRadius: '16px',
                                    border: '1px solid #E2E8F0',
                                    p: 4,
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.3s',
                                    '&:hover': {
                                        boxShadow: '0 8px 24px rgba(21,101,192,0.08)',
                                        borderColor: '#DBEAFE',
                                    },
                                }}
                            >
                                <FormatQuote sx={{ color: '#1565C0', fontSize: 36, mb: 1.5, transform: 'scaleX(-1)' }} />
                                <Typography
                                    variant="body2"
                                    sx={{ color: '#64748B', lineHeight: 1.7, flex: 1, mb: 3 }}
                                >
                                    {review.quote}
                                </Typography>
                                <Divider sx={{ borderColor: '#E2E8F0', mb: 2 }} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                                        {review.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                                        {review.company}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
