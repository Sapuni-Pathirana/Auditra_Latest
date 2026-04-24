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
import NotificationsIcon from '@mui/icons-material/Notifications';
import MailIcon from '@mui/icons-material/Mail';

export const roleMenuConfig = {
  admin: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Client Submissions', path: '/dashboard/client-submissions', icon: AssignmentIcon },
    { label: 'Employee Applications', path: '/dashboard/employee-submissions', icon: PersonAddIcon },
    { label: 'Project Approvals', path: '/dashboard/direct-project-approvals', icon: ApprovalIcon },
    { label: 'Cancellation Requests', path: '/dashboard/cancellation-requests', icon: BlockIcon },
    { label: 'User Management', path: '/dashboard/users', icon: PeopleIcon },
    { label: 'Projects', path: '/dashboard/projects', icon: FolderIcon },
    { label: 'Removal Requests', path: '/dashboard/removal-requests', icon: PersonRemoveIcon },
    { label: 'Invitations', path: '/dashboard/invitations', icon: MailIcon },
    { label: 'System Logs', path: '/dashboard/system-logs', icon: HistoryIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  hr_head: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Leave Management', path: '/dashboard/leave-management', icon: BeachAccessIcon },
    { label: 'Request Removal', path: '/dashboard/request-removal', icon: PersonRemoveIcon },
    { label: 'Attendance Summary', path: '/dashboard/attendance-summary', icon: EventNoteIcon },
    { label: 'Payments', path: '/dashboard/payments', icon: PaymentIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  coordinator: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Assigned Submissions', path: '/dashboard/assigned-submissions', icon: AssignmentIcon },
    { label: 'Projects', path: '/dashboard/projects', icon: FolderIcon },
    { label: 'Create Project', path: '/dashboard/projects/create', icon: AddCircleIcon },
    { label: 'My Attendance', path: '/dashboard/my-attendance', icon: EventNoteIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  accessor: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'My Projects', path: '/dashboard/my-projects', icon: FolderIcon },
    { label: 'My Attendance', path: '/dashboard/my-attendance', icon: EventNoteIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  senior_valuer: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Valuation Review', path: '/dashboard/valuation-review', icon: RateReviewIcon },
    { label: 'My Attendance', path: '/dashboard/my-attendance', icon: EventNoteIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'My Projects', path: '/dashboard/sv-projects', icon: FolderIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  md_gm: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Project Approval', path: '/dashboard/project-approval', icon: ApprovalIcon },
    { label: 'Valuation Review', path: '/dashboard/md-gm-valuation-review', icon: RateReviewIcon },
    { label: 'My Attendance', path: '/dashboard/my-attendance', icon: EventNoteIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  field_officer: [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'My Projects', path: '/dashboard/my-projects', icon: FolderIcon },
    { label: 'My Attendance', path: '/dashboard/my-attendance', icon: EventNoteIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  general_employee: [
    { label: 'My Attendance', path: '/dashboard', icon: EventNoteIcon },
    { label: 'My Leave', path: '/dashboard/my-leave', icon: BeachAccessIcon },
    { label: 'My Payments', path: '/dashboard/my-payments', icon: PaymentIcon },
    { label: 'Notifications', path: '/dashboard/notifications', icon: NotificationsIcon },
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
    { label: 'Profile', path: '/dashboard/profile', icon: PersonIcon },
  ],
  unassigned: [
    { label: 'Profile', path: '/dashboard', icon: PersonIcon },
  ],
};

const ROLE_ALIASES = {
  'field officer': 'field_officer',
  'field-officer': 'field_officer',
  fieldofficer: 'field_officer',
  assessor: 'accessor',
  'senior valuer': 'senior_valuer',
  'senior-valuer': 'senior_valuer',
  seniorvaluer: 'senior_valuer',
  'md/gm': 'md_gm',
  'md-gm': 'md_gm',
  mdgm: 'md_gm',
};

export const normalizeRoleKey = (role) => {
  if (!role || typeof role !== 'string') return role;
  return role.trim().toLowerCase().replace(/[\s-]+/g, '_');
};

export const resolveRoleKey = (role) => {
  if (!role || typeof role !== 'string') return role;
  const normalized = normalizeRoleKey(role);
  return ROLE_ALIASES[normalized] || ROLE_ALIASES[role.trim().toLowerCase()] || normalized;
};

export const getRoleDashboardPath = (role) => {
  return '/dashboard';
};

export const getRoleLabel = (role) => {
  const resolvedRole = resolveRoleKey(role);
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
  return labels[resolvedRole] || role;
};
