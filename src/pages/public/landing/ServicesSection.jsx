import { Box, Container, Grid, Typography } from '@mui/material';

const services = [
    {
        number: '01',
        title: 'Financial Auditing',
        desc: 'Comprehensive financial statement audits and reviews ensuring accuracy and regulatory compliance.',
    },
    {
        number: '02',
        title: 'Tax Advisory',
        desc: 'Strategic tax planning, compliance reviews, and advisory services to optimize your financial position.',
    },
    {
        number: '03',
        title: 'Business Consulting',
        desc: 'Expert strategic advisory to improve business performance, operations, and long-term profitability.',
    },
    {
        number: '04',
        title: 'Legal Compliance',
        desc: 'Ensuring your operations adhere to all relevant legal frameworks and regulatory requirements.',
    },
    {
        number: '05',
        title: 'Asset Valuation',
        desc: 'Accurate and reliable property, plant, and equipment valuations trusted by financial institutions.',
    },
    {
        number: '06',
        title: 'IT Auditing',
        desc: 'Information systems audits and cybersecurity assessments to protect your digital infrastructure.',
    },
];

export default function ServicesSection() {
    return (
        <Box id="services" sx={{ py: { xs: 5, md: 6 }, bgcolor: '#F1F5F9' }}>
            <Container maxWidth="lg">
                {/* Section Header */}
                <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 640, mx: 'auto' }}>
                    <Typography
                        variant="overline"
                        sx={{ color: '#1565C0', fontWeight: 700, letterSpacing: 2.5, fontSize: '0.8rem' }}
                    >
                        OUR SERVICES
                    </Typography>
                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 700, color: '#0F172A', mt: 1, mb: 2,
                            fontSize: { xs: '1.8rem', md: '2.4rem' },
                        }}
                    >
                        Comprehensive Professional Solutions
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748B', fontSize: '1.05rem', lineHeight: 1.7 }}>
                        We offer a wide range of services designed to meet the diverse needs of modern businesses.
                    </Typography>
                </Box>

                {/* Services Grid */}
                <Grid container spacing={3}>
                    {services.map((service, i) => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Box
                                sx={{
                                    height: '100%',
                                    bgcolor: '#fff',
                                    border: '1px solid #E2E8F0',
                                    borderTop: '3px solid #1565C0',
                                    borderRadius: '0 0 4px 4px',
                                    p: { xs: 3, md: 3.5 },
                                    transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                                    cursor: 'default',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 32px rgba(21,101,192,0.08)',
                                        borderTopColor: '#0D47A1',
                                    },
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontWeight: 800,
                                        fontSize: '2.2rem',
                                        color: '#E2E8F0',
                                        lineHeight: 1,
                                        mb: 2,
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {service.number}
                                </Typography>
                                <Typography
                                    variant="h6"
                                    sx={{ fontWeight: 700, color: '#0F172A', mb: 1.5, fontSize: '1.05rem' }}
                                >
                                    {service.title}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.7 }}>
                                    {service.desc}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}
