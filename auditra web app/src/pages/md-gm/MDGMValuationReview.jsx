import { useLocation } from 'react-router-dom';
import { Box, Typography, Alert, Button } from '@mui/material';
import { CheckCircle, Download } from '@mui/icons-material';
import valuationService from '../../services/valuationService';
import ValuationReviewPage from '../../components/ValuationReviewPage';

export default function MDGMValuationReview() {
  const location = useLocation();
  const getStatusLabel = (status) => {
    if (status === 'md_approved') return 'MD/GM Approved';
    if (status === 'approved') return 'Pending Approval';
    return status;
  };

  return (
    <ValuationReviewPage
      initialFilter={location.state?.filter}
      fetchValuations={() => valuationService.getMDGMValuations()}
      pendingPredicate={(status) => status === 'approved'}
      approvedPredicate={(status) => status === 'md_approved'}
      rejectedPredicate={(status) => status === 'rejected'}
      mapStatusForChip={(status) => ({
        status: status === 'md_approved' ? 'approved' : status,
        label: getStatusLabel(status),
      })}
      approveActionConfig={{
        action: valuationService.mdGmApprove,
        buildPayload: (remarks) => ({ md_gm_comments: remarks }),
        successMessage: 'Valuation approved successfully',
        errorMessage: 'Failed to approve valuation',
        label: 'Approve',
        icon: <CheckCircle />,
      }}
      rejectActionConfig={{
        action: valuationService.mdGmReject,
        buildPayload: (remarks) => ({ rejection_reason: remarks, md_gm_comments: remarks }),
        successMessage: 'Valuation rejected successfully',
        errorMessage: 'Failed to reject valuation',
      }}
      remarksLabel="Remarks (required for rejection)"
      renderExtraDetails={(valuation) => (
        <>
          {valuation.senior_valuer_comments && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Senior Valuer Comments</Typography>
              <Alert severity="info" sx={{ mt: 0.5 }}>
                {valuation.senior_valuer_comments}
              </Alert>
            </Box>
          )}
          {valuation.final_report_url && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Final Report</Typography>
              <Button size="small" startIcon={<Download />} href={valuation.final_report_url} target="_blank" sx={{ mt: 0.5 }}>
                Download Report
              </Button>
            </Box>
          )}
          {valuation.submitted_report_url && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Submitted Report</Typography>
              <Button size="small" startIcon={<Download />} href={valuation.submitted_report_url} target="_blank" sx={{ mt: 0.5 }}>
                Download Report
              </Button>
            </Box>
          )}
          {valuation.md_gm_comments && valuation.status === 'md_approved' && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">MD/GM Comments</Typography>
              <Alert severity="success" sx={{ mt: 0.5 }}>
                {valuation.md_gm_comments}
              </Alert>
            </Box>
          )}
        </>
      )}
    />
  );
}
