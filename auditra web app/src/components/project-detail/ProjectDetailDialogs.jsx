import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { AttachMoney, Block, Download, Send } from '@mui/icons-material';

export default function ProjectDetailDialogs({
  rejectPaymentDialog,
  paymentLoading,
  onCloseRejectPaymentDialog,
  paymentRejectReason,
  onChangePaymentRejectReason,
  onConfirmRejectPayment,

  cancelDialog,
  cancelLoading,
  onCloseCancelDialog,
  cancelReason,
  onChangeCancelReason,
  onConfirmCancellation,

  agentPaymentDialog,
  agentPaymentLoading,
  onCloseAgentPaymentDialog,
  agentPaymentAmount,
  onChangeAgentPaymentAmount,
  agentPaymentNotes,
  onChangeAgentPaymentNotes,
  onConfirmAgentPayment,

  reportDialog,
  onCloseReportDialog,
  generatedReport,
  sendingReport,
  onSendReport,

  docVisibilityDialog,
  onCloseDocVisibilityDialog,
  docVisibleTo,
  onChangeDocVisibleTo,
  visibilityMembers,
  onUploadDocument,
}) {
  return (
    <>
      <Dialog open={rejectPaymentDialog} onClose={() => !paymentLoading && onCloseRejectPaymentDialog()} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
            Reject Payment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this payment. The client will be notified and may re-submit a bank slip.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Please specify the reason for rejection (e.g., bank slip is unclear, amount does not match the invoice, etc.)"
            value={paymentRejectReason}
            onChange={(e) => onChangePaymentRejectReason(e.target.value)}
            required
            error={!paymentRejectReason.trim() && rejectPaymentDialog}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCloseRejectPaymentDialog} disabled={paymentLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onConfirmRejectPayment}
            disabled={paymentLoading || !paymentRejectReason.trim()}
          >
            {paymentLoading ? 'Processing...' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelDialog} onClose={() => !cancelLoading && onCloseCancelDialog()} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
            Request Project Cancellation
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for cancelling this project. Your request will be sent to the admin for review. All assigned team members will be notified of the decision.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Cancellation Reason"
            placeholder="Please explain why this project needs to be cancelled..."
            value={cancelReason}
            onChange={(e) => onChangeCancelReason(e.target.value)}
            required
            error={!cancelReason.trim() && cancelDialog}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCloseCancelDialog} disabled={cancelLoading}>
            Go Back
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onConfirmCancellation}
            disabled={cancelLoading || !cancelReason.trim()}
            startIcon={<Block />}
          >
            {cancelLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={agentPaymentDialog} onClose={() => !agentPaymentLoading && onCloseAgentPaymentDialog()} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Record Agent Payment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Record the payment made to the agent for this project. The agent will be able to see this in their payments tab.
          </Typography>
          <TextField
            fullWidth
            label="Payment Amount (Rs.)"
            type="number"
            value={agentPaymentAmount}
            onChange={(e) => onChangeAgentPaymentAmount(e.target.value)}
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes (Optional)"
            placeholder="Any notes about this payment..."
            value={agentPaymentNotes}
            onChange={(e) => onChangeAgentPaymentNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCloseAgentPaymentDialog} disabled={agentPaymentLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onConfirmAgentPayment}
            disabled={agentPaymentLoading || !agentPaymentAmount || Number(agentPaymentAmount) <= 0}
            startIcon={<AttachMoney />}
          >
            {agentPaymentLoading ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reportDialog} onClose={onCloseReportDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Commission Report
          </Typography>
        </DialogTitle>
        <DialogContent>
          {generatedReport && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Commission report generated successfully!
              </Alert>
              <Box sx={{ p: 2, bgcolor: (t) => t.palette.custom?.cardInner || '#f5f5f5', borderRadius: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Project</Typography>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>{generatedReport.project_title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Agent</Typography>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>{generatedReport.agent_name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>Commission Amount</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  Rs. {Number(generatedReport.commission_amount).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {generatedReport.report_file_url && (
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    href={generatedReport.report_file_url}
                    target="_blank"
                    size="small"
                  >
                    Download Report
                  </Button>
                )}
                {!generatedReport.sent_to_agent && (
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={onSendReport}
                    disabled={sendingReport}
                    size="small"
                  >
                    {sendingReport ? 'Sending...' : 'Send to Agent'}
                  </Button>
                )}
                {generatedReport.sent_to_agent && (
                  <Alert severity="info" sx={{ flex: 1 }}>
                    Report has been sent to the agent.
                  </Alert>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCloseReportDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={docVisibilityDialog.open} onClose={onCloseDocVisibilityDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Document Visibility</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which team members can view this document. Leave empty to allow all members to view it.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Visible To</InputLabel>
            <Select
              multiple
              value={docVisibleTo}
              onChange={(e) => onChangeDocVisibleTo(e.target.value)}
              input={<OutlinedInput label="Visible To" />}
              renderValue={(selected) => selected
                .map((uid) => visibilityMembers.find((m) => Number(m.id) === Number(uid))?.name || uid)
                .join(', ')}
            >
              {visibilityMembers.map((member) => {
                const userId = Number(member.id);
                const name = member.name;
                return (
                  <MenuItem key={userId} value={userId}>
                    <Checkbox checked={docVisibleTo.some((id) => Number(id) === userId)} />
                    <ListItemText primary={name} secondary={member.role} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDocVisibilityDialog}>Cancel</Button>
          <Button variant="contained" onClick={onUploadDocument}>Upload</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
