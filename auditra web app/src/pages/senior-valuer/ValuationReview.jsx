import { useLocation } from 'react-router-dom';
import { Send } from '@mui/icons-material';
import valuationService from '../../services/valuationService';
import ValuationReviewPage from '../../components/ValuationReviewPage';

export default function ValuationReview() {
  const location = useLocation();
  const isPending = (status) => status === 'pending' || status === 'submitted' || status === 'reviewed';

  return (
    <ValuationReviewPage
      initialFilter={location.state?.filter}
      fetchValuations={() => valuationService.getValuations()}
      pendingPredicate={isPending}
      approvedPredicate={(status) => status === 'approved'}
      rejectedPredicate={(status) => status === 'rejected'}
      approveActionConfig={{
        action: valuationService.approveValuation,
        buildPayload: (remarks) => ({ senior_valuer_comments: remarks }),
        successMessage: 'Valuation approved and sent to MD/GM for final approval',
        errorMessage: 'Failed to approve valuation',
        label: 'Approve & Send to MD/GM',
        icon: <Send />,
      }}
      rejectActionConfig={{
        action: valuationService.seniorValuerReject,
        buildPayload: (remarks) => ({ rejection_reason: remarks }),
        successMessage: 'Valuation rejected successfully',
        errorMessage: 'Failed to reject valuation',
      }}
    />
  );
}
