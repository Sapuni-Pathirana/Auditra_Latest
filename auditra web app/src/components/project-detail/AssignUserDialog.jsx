import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Typography } from '@mui/material';

const PLACEHOLDER_BY_TYPE = {
  field_officer: 'Select a Field Officer',
  accessor: 'Select an Accessor',
  senior_valuer: 'Select a Senior Valuer',
  client: 'Select a Client',
  agent: 'Select an Agent',
};

export default function AssignUserDialog({
  open,
  assignType,
  selectedUser,
  availableUsers,
  onClose,
  onChangeUser,
  onConfirm,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
          Assign {assignType?.replace(/_/g, ' ')}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please select a {assignType?.replace(/_/g, ' ')} to assign to this project.
        </Typography>
        <Select
          fullWidth
          value={selectedUser}
          onChange={(e) => onChangeUser(e.target.value)}
          displayEmpty
          sx={{ mt: 1 }}
        >
          <MenuItem value="" disabled>
            {PLACEHOLDER_BY_TYPE[assignType] || 'Select a user'}
          </MenuItem>
          {availableUsers.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username}
              {u.email ? ` (${u.email})` : ''}
              {u.assigned_projects_count > 0 ? ` — ${u.assigned_projects_count} project${u.assigned_projects_count > 1 ? 's' : ''}` : ''}
            </MenuItem>
          ))}
        </Select>
        {availableUsers.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
            No {assignType?.replace(/_/g, ' ')}s are currently available.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={!selectedUser}>Confirm Assignment</Button>
      </DialogActions>
    </Dialog>
  );
}
