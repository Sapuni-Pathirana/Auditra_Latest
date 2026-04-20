import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import EventNoteIcon from '@mui/icons-material/EventNote';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import FolderIcon from '@mui/icons-material/Folder';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import RateReviewIcon from '@mui/icons-material/RateReview';
import ApprovalIcon from '@mui/icons-material/Approval';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import VisibilityIcon from '@mui/icons-material/Visibility';

export const roleMenuConfig = {
  admin: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Client Submissions', path: '/dashboard/client-submissions', icon: AssignmentIcon },
    { label: 'Employee Applications', path: '/dashboard/employee-submissions', icon: PersonAddIcon },
    { label: 'Project Approvals', path: '/dashboard/direct-project-approvals', icon: ApprovalIcon },
    { label: 'Cancellation Requests', path: '/dashboard/cancellation-requests', icon: BlockIcon },
    { label: 'User Management', path: '/dashboard/users', icon: PeopleIcon },
    { label: 'Projects', path: '/dashboard/projects', icon: FolderIcon },
    { label: 'Attendance Summary', path: '/dashboard/attendance-summary', icon: EventNoteIcon },
    { label: 'Leave Management', path: '/dashboard/leave-management', icon: BeachAccessIcon },
    { label: 'Payments', path: '/dashboard/payments', icon: PaymentIcon },
    { label: 'Removal Requests', path: '/dashboard/removal-requests', icon: PersonRemoveIcon },
    { label: 'System Logs', path: '/dashboard/system-logs', icon: HistoryIcon },
  ],
  hr_head: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Leave Management', path: '/dashboard/leave-management', icon: BeachAccessIcon },
    { label: 'Attendance Summary', path: '/dashboard/attendance-summary', icon: EventNoteIcon },
    { label: 'Attendance View', path: '/dashboard/attendance-view', icon: VisibilityIcon },
    { label: 'Payments', path: '/dashboard/payments', icon: PaymentIcon },
    { label: 'Request Removal', path: '/dashboard/request-removal', icon: PersonRemoveIcon },
  ],
  coordinator: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Assigned Submissions', path: '/dashboard/assigned-submissions', icon: AssignmentIcon },
    { label: 'Projects', path: '/dashboard/projects', icon: FolderIcon },
    { label: 'Create Project', path: '/dashboard/projects/create', icon: AddCircleIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
  ],
  accessor: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'My Projects', path: '/dashboard/my-projects', icon: FolderIcon },
  ],
  senior_valuer: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'My Projects', path: '/dashboard/sv-projects', icon: FolderIcon },
    { label: 'Valuation Review', path: '/dashboard/valuation-review', icon: RateReviewIcon },
  ],
  md_gm: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Project Approval', path: '/dashboard/project-approval', icon: ApprovalIcon },
    { label: 'Valuation Review', path: '/dashboard/md-gm-valuation-review', icon: RateReviewIcon },
  ],
  field_officer: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'My Projects', path: '/dashboard/my-projects', icon: FolderIcon },
  ],
  general_employee: [
    { label: 'My Attendance', path: '/dashboard', icon: EventNoteIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  client: [
    { label: 'My Projects', path: '/dashboard', icon: FolderIcon },
    { label: 'Payments', path: '/dashboard/client-payments', icon: PaymentIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  agent: [
    { label: 'My Projects', path: '/dashboard', icon: FolderIcon },
    { label: 'Payments', path: '/dashboard/agent-payments', icon: PaymentIcon },
    { label: 'Commission Reports', path: '/dashboard/agent-commission-reports', icon: ReceiptLongIcon },
  ],
  unassigned: [
    { label: 'Profile', path: '/dashboard', icon: PersonIcon },
  ],
};

export const getRoleDashboardPath = (role) => {
  return '/dashboard';
};

export const getRoleLabel = (role) => {
  const labels = {
    admin: 'Admin',
    coordinator: 'Coordinator',
    field_officer: 'Field Officer',
    hr_head: 'HR Head',
    accessor: 'Accessor',
    senior_valuer: 'Senior Valuer',
    md_gm: 'MD/GM',
    general_employee: 'General Employee',
    client: 'Client',
    agent: 'Agent',
    unassigned: 'Unassigned',
  };
  return labels[role] || role;
};
