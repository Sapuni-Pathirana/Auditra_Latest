import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Public pages
import LandingPage from './pages/public/LandingPage';
import ClientFormPage from './pages/public/ClientFormPage';
import EmployeeFormPage from './pages/public/EmployeeFormPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AttendanceSummary from './pages/admin/AttendanceSummary';
import LeaveManagement from './pages/admin/LeaveManagement';
import PaymentManagement from './pages/admin/PaymentManagement';
import RemovalRequests from './pages/admin/RemovalRequests';
import SystemLogs from './pages/admin/SystemLogs';
import ClientSubmissions from './pages/admin/ClientSubmissions';
import EmployeeSubmissions from './pages/admin/EmployeeSubmissions';
import CancellationRequests from './pages/admin/CancellationRequests';
import DirectProjectApprovals from './pages/admin/DirectProjectApprovals';

// Coordinator pages
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import ProjectList from './pages/coordinator/ProjectList';
import CreateProject from './pages/coordinator/CreateProject';
import ProjectDetail from './pages/coordinator/ProjectDetail';
import EditProject from './pages/coordinator/EditProject';
import AssignedSubmissions from './pages/coordinator/AssignedSubmissions';

// HR pages
import HRDashboard from './pages/hr/HRDashboard';
import LeaveRequests from './pages/hr/LeaveRequests';
import AttendanceView from './pages/hr/AttendanceView';
import RemovalRequest from './pages/hr/RemovalRequest';

// Accessor pages
import AccessorDashboard from './pages/accessor/AccessorDashboard';
import AccessorProjects from './pages/accessor/AccessorProjects';

// Senior Valuer pages
import SeniorValuerDashboard from './pages/senior-valuer/SeniorValuerDashboard';
import ValuationReview from './pages/senior-valuer/ValuationReview';
import SeniorValuerProjects from './pages/senior-valuer/SeniorValuerProjects';

// MD/GM pages
import MDGMDashboard from './pages/md-gm/MDGMDashboard';
import ProjectApproval from './pages/md-gm/ProjectApproval';
import MDGMValuationReview from './pages/md-gm/MDGMValuationReview';

// Shared pages
import MyAttendance from './pages/shared/MyAttendance';
import MyLeaveRequests from './pages/shared/MyLeaveRequests';
import MyPaymentSlips from './pages/shared/MyPaymentSlips';
import PersonalInfo from './pages/shared/PersonalInfo';
import ChangePassword from './pages/shared/ChangePassword';
import ForceChangePassword from './pages/auth/ForceChangePassword';
import MyProjects from './pages/shared/MyProjects';

// Field Officer
import FieldOfficerDashboard from './pages/field-officer/FieldOfficerDashboard';

// Client pages
import ClientPayments from './pages/client/ClientPayments';

// Agent pages
import AgentPayments from './pages/agent/AgentPayments';
import AgentCommissionReports from './pages/agent/AgentCommissionReports';

// Unassigned
import UnassignedDashboard from './pages/unassigned/UnassignedDashboard';

import { roleMenuConfig } from './utils/roleConfig';

// Role-based dashboard component — redirects to the first visible sidebar tab
function RoleDashboard() {
  const { role } = useAuth();

  // Get the menu items for this role
  const menuItems = roleMenuConfig[role] || roleMenuConfig.unassigned;

  // If the first menu item path is not /dashboard, redirect there
  if (menuItems.length > 0 && menuItems[0].path !== '/dashboard') {
    return <Navigate to={menuItems[0].path} replace />;
  }

  // For roles whose first item IS /dashboard, render the appropriate content
  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'hr_head':
      return <HRDashboard />;
    case 'coordinator':
      return <CoordinatorDashboard />;
    case 'accessor':
      return <AccessorDashboard />;
    case 'senior_valuer':
      return <SeniorValuerDashboard />;
    case 'md_gm':
      return <MDGMDashboard />;
    case 'field_officer':
      return <FieldOfficerDashboard />;
    case 'general_employee':
      return <MyAttendance />;
    case 'client':
    case 'agent':
      return <MyProjects />;
    case 'unassigned':
    default:
      return <UnassignedDashboard />;
  }
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/client-register" element={<ClientFormPage />} />
      <Route path="/employee-register" element={<EmployeeFormPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes - wrapped in Layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Default dashboard based on role */}
        <Route index element={<RoleDashboard />} />

        {/* Admin routes */}
        <Route path="users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="removal-requests" element={<ProtectedRoute allowedRoles={['admin']}><RemovalRequests /></ProtectedRoute>} />
        <Route path="system-logs" element={<ProtectedRoute allowedRoles={['admin']}><SystemLogs /></ProtectedRoute>} />
        <Route path="client-submissions" element={<ProtectedRoute allowedRoles={['admin']}><ClientSubmissions /></ProtectedRoute>} />
        <Route path="employee-submissions" element={<ProtectedRoute allowedRoles={['admin']}><EmployeeSubmissions /></ProtectedRoute>} />
        <Route path="cancellation-requests" element={<ProtectedRoute allowedRoles={['admin']}><CancellationRequests /></ProtectedRoute>} />
        <Route path="direct-project-approvals" element={<ProtectedRoute allowedRoles={['admin']}><DirectProjectApprovals /></ProtectedRoute>} />

        {/* HR Head routes (also accessible by admin) */}
        <Route path="attendance-summary" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><AttendanceSummary /></ProtectedRoute>} />
        <Route path="leave-management" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><LeaveManagement /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><PaymentManagement /></ProtectedRoute>} />
        <Route path="leave-requests" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><LeaveRequests /></ProtectedRoute>} />
        <Route path="attendance-view" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><AttendanceView /></ProtectedRoute>} />
        <Route path="request-removal" element={<ProtectedRoute allowedRoles={['admin', 'hr_head']}><RemovalRequest /></ProtectedRoute>} />

        {/* Coordinator routes */}
        <Route path="assigned-submissions" element={<ProtectedRoute allowedRoles={['coordinator']}><AssignedSubmissions /></ProtectedRoute>} />
        <Route path="projects" element={<ProtectedRoute allowedRoles={['admin', 'coordinator']}><ProjectList /></ProtectedRoute>} />
        <Route path="projects/create" element={<ProtectedRoute allowedRoles={['coordinator']}><CreateProject /></ProtectedRoute>} />
        <Route path="projects/:id/edit" element={<ProtectedRoute allowedRoles={['coordinator']}><EditProject /></ProtectedRoute>} />
        <Route path="projects/:id" element={<ProjectDetail />} />

        {/* Accessor routes */}
        <Route path="my-projects" element={<AccessorProjects />} />

        {/* Senior Valuer routes */}
        <Route path="valuation-review" element={<ProtectedRoute allowedRoles={['senior_valuer']}><ValuationReview /></ProtectedRoute>} />
        <Route path="sv-projects" element={<ProtectedRoute allowedRoles={['senior_valuer']}><SeniorValuerProjects /></ProtectedRoute>} />

        {/* MD/GM routes */}
        <Route path="project-approval" element={<ProtectedRoute allowedRoles={['md_gm']}><ProjectApproval /></ProtectedRoute>} />
        <Route path="md-gm-valuation-review" element={<ProtectedRoute allowedRoles={['md_gm']}><MDGMValuationReview /></ProtectedRoute>} />

        {/* Client routes */}
        <Route path="client-payments" element={<ProtectedRoute allowedRoles={['client']}><ClientPayments /></ProtectedRoute>} />

        {/* Agent routes */}
        <Route path="agent-payments" element={<ProtectedRoute allowedRoles={['agent']}><AgentPayments /></ProtectedRoute>} />
        <Route path="agent-commission-reports" element={<ProtectedRoute allowedRoles={['agent']}><AgentCommissionReports /></ProtectedRoute>} />

        {/* Shared routes - accessible by all authenticated users */}
        <Route path="my-attendance" element={<MyAttendance />} />
        <Route path="my-leave" element={<MyLeaveRequests />} />
        <Route path="my-payments" element={<MyPaymentSlips />} />
        <Route path="profile" element={<PersonalInfo />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="force-change-password" element={<ForceChangePassword />} />
      </Route>

      {/* Catch all - redirect to dashboard if authenticated, else to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
