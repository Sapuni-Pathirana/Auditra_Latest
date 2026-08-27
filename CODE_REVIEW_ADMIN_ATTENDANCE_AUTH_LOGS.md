# Auditra Code Review Guide (Easy Explanation Version)

This guide helps you explain the project during your review or viva.

It is written in a simple way so you can:

- Understand the flow quickly
- Find the correct file when the instructor asks
- Know which backend connects to which frontend page
- Know where to do changes with exact line numbers

## 1. Project Starting Points

These are the main files where the project starts.

### Web Application Entry

| What it does | File | Important line |
|---|---|---|
| Starts React app | [auditra web app/src/main.jsx](auditra%20web%20app/src/main.jsx) | Full file |
| Main routing system | [auditra web app/src/App.jsx#L145](auditra%20web%20app/src/App.jsx#L145) | `#L145` onward |
| Authentication state management | [auditra web app/src/contexts/AuthContext.jsx#L13](auditra%20web%20app/src/contexts/AuthContext.jsx#L13) | `#L13` |
| Route protection by role | [auditra web app/src/components/ProtectedRoute.jsx#L6](auditra%20web%20app/src/components/ProtectedRoute.jsx#L6) | `#L6` |
| Main dashboard layout | [auditra web app/src/components/Layout.jsx#L22](auditra%20web%20app/src/components/Layout.jsx#L22) | `#L22` |
| Axios token handling | [auditra web app/src/api/axiosClient.js#L5](auditra%20web%20app/src/api/axiosClient.js#L5) | `#L5` |

### When Instructor Asks: Where are routes defined?

Go to:

[auditra web app/src/App.jsx#L145](auditra%20web%20app/src/App.jsx#L145)

That file contains dashboard routes like:

- `/dashboard/users`
- `/dashboard/system-logs`
- `/dashboard/client-submissions`

### When Instructor Asks: Where is authentication handled?

Frontend:

[auditra web app/src/contexts/AuthContext.jsx#L13](auditra%20web%20app/src/contexts/AuthContext.jsx#L13)

Backend login API:

[backend/authentication/views.py#L106](backend/authentication/views.py#L106)

### Backend Entry Points

| Purpose | File | Line |
|---|---|---|
| Main backend route mounting | [backend/auditra_backend/urls.py#L48](backend/auditra_backend/urls.py#L48) | `#L48` |
| Authentication APIs | [backend/auditra_backend/urls.py#L49](backend/auditra_backend/urls.py#L49) | `#L49` |
| Attendance APIs | [backend/auditra_backend/urls.py#L52](backend/auditra_backend/urls.py#L52) | `#L52` |
| System log APIs | [backend/auditra_backend/urls.py#L55](backend/auditra_backend/urls.py#L55) | `#L55` |

## 2. Admin Pages (Frontend + Backend Connection)

### Admin Dashboard

Frontend

Page:

[auditra web app/src/pages/admin/AdminDashboard.jsx#L27](auditra%20web%20app/src/pages/admin/AdminDashboard.jsx#L27)

API calls:

[auditra web app/src/pages/admin/AdminDashboard.jsx#L37](auditra%20web%20app/src/pages/admin/AdminDashboard.jsx#L37)

Backend

Main logic:

[backend/authentication/views.py#L2794](backend/authentication/views.py#L2794)

Extra KPI charts:

[backend/authentication/views.py#L2872](backend/authentication/views.py#L2872)

Routes:

[backend/authentication/urls.py#L103](backend/authentication/urls.py#L103)

[backend/authentication/urls.py#L104](backend/authentication/urls.py#L104)

What it does

- Loads admin statistics
- Loads KPI charts
- Shows user counts
- Shows project counts
- Shows delivery metrics

If instructor says: Change dashboard cards

Go to:

[auditra web app/src/pages/admin/AdminDashboard.jsx#L27](auditra%20web%20app/src/pages/admin/AdminDashboard.jsx#L27)

Main UI starts there.

### User Management Page

Frontend

Main page:

[auditra web app/src/pages/admin/UserManagement.jsx#L12](auditra%20web%20app/src/pages/admin/UserManagement.jsx#L12)

Load users:

[auditra web app/src/pages/admin/UserManagement.jsx#L22](auditra%20web%20app/src/pages/admin/UserManagement.jsx#L22)

Delete users:

[auditra web app/src/pages/admin/UserManagement.jsx#L55](auditra%20web%20app/src/pages/admin/UserManagement.jsx#L55)

Backend

Get users:

[backend/authentication/views.py#L490](backend/authentication/views.py#L490)

Assign roles:

[backend/authentication/views.py#L343](backend/authentication/views.py#L343)

Delete users:

[backend/authentication/views.py#L421](backend/authentication/views.py#L421)

What it does

- Shows all users
- Assigns roles
- Deletes users
- Protects admin accounts

If instructor says: Where can you change role logic?

Backend:

[backend/authentication/views.py#L343](backend/authentication/views.py#L343)

### System Logs Page

Frontend

Page:

[auditra web app/src/pages/admin/SystemLogs.jsx#L274](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L274)

Load logs:

[auditra web app/src/pages/admin/SystemLogs.jsx#L302](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L302)

Verify chain button:

[auditra web app/src/pages/admin/SystemLogs.jsx#L318](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L318)

Backend

List logs:

[backend/system_logs/views.py#L10](backend/system_logs/views.py#L10)

Verify blockchain chain:

[backend/system_logs/views.py#L55](backend/system_logs/views.py#L55)

Hash generation:

[backend/system_logs/models.py#L89](backend/system_logs/models.py#L89)

What it does

- Shows audit logs
- Filters logs
- Verifies hash chain integrity
- Detects tampering

If instructor says: Where is blockchain-like verification implemented?

Go to:

[backend/system_logs/utils.py#L33](backend/system_logs/utils.py#L33)

### Client Submissions

Frontend

Page:

[auditra web app/src/pages/admin/ClientSubmissions.jsx#L65](auditra%20web%20app/src/pages/admin/ClientSubmissions.jsx#L65)

Approve submission:

[auditra web app/src/pages/admin/ClientSubmissions.jsx#L216](auditra%20web%20app/src/pages/admin/ClientSubmissions.jsx#L216)

Assign coordinator:

[auditra web app/src/pages/admin/ClientSubmissions.jsx#L178](auditra%20web%20app/src/pages/admin/ClientSubmissions.jsx#L178)

Backend

Main APIs:

[backend/authentication/views.py#L1974](backend/authentication/views.py#L1974)

[backend/authentication/views.py#L2039](backend/authentication/views.py#L2039)

[backend/authentication/views.py#L2153](backend/authentication/views.py#L2153)

What it does

- Reviews client forms
- Approves or rejects submissions
- Assigns coordinators

### Employee Submissions

Frontend

Page:

[auditra web app/src/pages/admin/EmployeeSubmissions.jsx#L88](auditra%20web%20app/src/pages/admin/EmployeeSubmissions.jsx#L88)

Backend

Hire employee:

[backend/authentication/views.py#L2468](backend/authentication/views.py#L2468)

Role salary lookup:

[backend/authentication/views.py#L2452](backend/authentication/views.py#L2452)

What it does

- Reviews employee applications
- Creates real users after hiring
- Sends login credentials
- Stores invitation tracking data

### Removal Requests

Frontend

Page:

[auditra web app/src/pages/admin/RemovalRequests.jsx#L12](auditra%20web%20app/src/pages/admin/RemovalRequests.jsx#L12)

Backend

Create request:

[backend/authentication/views.py#L1687](backend/authentication/views.py#L1687)

Approve request:

[backend/authentication/views.py#L1808](backend/authentication/views.py#L1808)

Reject request:

[backend/authentication/views.py#L1889](backend/authentication/views.py#L1889)

What it does

- HR Head creates removal requests
- Admin approves or rejects them
- Approval deletes the user account

### Cancellation Requests

Frontend

Page:

[auditra web app/src/pages/admin/CancellationRequests.jsx#L42](auditra%20web%20app/src/pages/admin/CancellationRequests.jsx#L42)

Backend

Approve cancellation:

[backend/projects/views.py#L2746](backend/projects/views.py#L2746)

Reject cancellation:

[backend/projects/views.py#L2851](backend/projects/views.py#L2851)

What it does

- Coordinator requests project cancellation
- Admin reviews the request
- Admin approves or rejects with remarks

### Direct Project Approvals

Frontend

Page:

[auditra web app/src/pages/admin/DirectProjectApprovals.jsx#L39](auditra%20web%20app/src/pages/admin/DirectProjectApprovals.jsx#L39)

Backend

Approve project:

[backend/projects/views.py#L1366](backend/projects/views.py#L1366)

Reject project:

[backend/projects/views.py#L1433](backend/projects/views.py#L1433)

Pending project list:

[backend/projects/views.py#L1577](backend/projects/views.py#L1577)

What it does

- Shows direct coordinator-created projects
- Admin approves or rejects them
- Keeps a separate admin approval flow

### Invitation Tracking

Frontend

Page:

[auditra web app/src/pages/admin/InvitationTracking.jsx#L17](auditra%20web%20app/src/pages/admin/InvitationTracking.jsx#L17)

Backend

API:

[backend/authentication/views.py#L2997](backend/authentication/views.py#L2997)

Model:

[backend/authentication/models.py#L812](backend/authentication/models.py#L812)

What it does

- Tracks sent credential emails
- Shows whether user accepted invite
- Shows password change completion state

### All Project Items

Frontend

Page:

[auditra web app/src/pages/admin/AllProjectItems.jsx#L14](auditra%20web%20app/src/pages/admin/AllProjectItems.jsx#L14)

Backend

API:

[backend/reports_v2/views.py#L53](backend/reports_v2/views.py#L53)

Route:

[backend/reports_v2/urls.py#L16](backend/reports_v2/urls.py#L16)

What it does

- Shows report items from all projects
- Filters by category and search
- Exports CSV from the frontend

## 3. Authentication System

### Login Flow

### Frontend Login Page

File:

[auditra web app/src/pages/auth/LoginPage.jsx#L27](auditra%20web%20app/src/pages/auth/LoginPage.jsx#L27)

Submit login:

[auditra web app/src/pages/auth/LoginPage.jsx#L51](auditra%20web%20app/src/pages/auth/LoginPage.jsx#L51)

Forgot password:

[auditra web app/src/pages/auth/LoginPage.jsx#L78](auditra%20web%20app/src/pages/auth/LoginPage.jsx#L78)

OTP verify:

[auditra web app/src/pages/auth/LoginPage.jsx#L92](auditra%20web%20app/src/pages/auth/LoginPage.jsx#L92)

### Backend Login API

File:

[backend/authentication/views.py#L106](backend/authentication/views.py#L106)

What happens

- User enters username or email and password
- Frontend calls backend login API
- Backend returns JWT token
- Token is stored in frontend
- Role is loaded from backend
- User is redirected to dashboard

### Token Refresh System

Frontend file:

[auditra web app/src/api/axiosClient.js#L31](auditra%20web%20app/src/api/axiosClient.js#L31)

What it does

- Detects expired token
- Automatically refreshes token
- Retries request

### Forgot Password Flow

| Action | Backend file |
|---|---|
| Send OTP | [backend/authentication/views.py#L253](backend/authentication/views.py#L253) |
| Verify OTP | [backend/authentication/views.py#L276](backend/authentication/views.py#L276) |
| Reset password | [backend/authentication/views.py#L301](backend/authentication/views.py#L301) |

### Important Authentication Support Files

| Purpose | File |
|---|---|
| Role model | [backend/authentication/models.py#L13](backend/authentication/models.py#L13) |
| Password reset OTP model | [backend/authentication/models.py#L104](backend/authentication/models.py#L104) |
| User profile model | [backend/authentication/models.py#L767](backend/authentication/models.py#L767) |
| Invitation model | [backend/authentication/models.py#L812](backend/authentication/models.py#L812) |
| Auth route table | [backend/authentication/urls.py#L58](backend/authentication/urls.py#L58) |

### Mobile Authentication Flow

### Flutter Mobile App Login Page (Direct Answer)

Login page widget:

[auditra/lib/screens/login_screen.dart#L6](auditra/lib/screens/login_screen.dart#L6)

Login action method:

[auditra/lib/screens/login_screen.dart#L27](auditra/lib/screens/login_screen.dart#L27)

Mobile login API call:

[auditra/lib/services/api_service.dart#L134](auditra/lib/services/api_service.dart#L134)

Login screen:

[auditra/lib/screens/login_screen.dart#L13](auditra/lib/screens/login_screen.dart#L13)

Login method:

[auditra/lib/screens/login_screen.dart#L27](auditra/lib/screens/login_screen.dart#L27)

Mobile API login:

[auditra/lib/services/api_service.dart#L134](auditra/lib/services/api_service.dart#L134)

Role loading:

[auditra/lib/services/api_service.dart#L365](auditra/lib/services/api_service.dart#L365)

What it does

- Mobile app logs in through the same backend auth system
- Stores access and refresh tokens in `SharedPreferences`
- Loads role after login
- Forces password change if backend says it is required

## 4. Attendance System

### Attendance In Both Flutter App And Web App

| Platform | Main page | Check-in action | Leave early | Check out | Overtime |
|---|---|---|---|---|---|
| Web app | [auditra web app/src/pages/shared/MyAttendance.jsx#L13](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L13) | [auditra web app/src/pages/shared/MyAttendance.jsx#L96](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L96) | [auditra web app/src/pages/shared/MyAttendance.jsx#L102](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L102) | [auditra web app/src/pages/shared/MyAttendance.jsx#L108](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L108) | [auditra web app/src/pages/shared/MyAttendance.jsx#L114](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L114) and [auditra web app/src/pages/shared/MyAttendance.jsx#L120](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L120) |
| Flutter app | [auditra/lib/screens/field_officer_dashboard.dart#L33](auditra/lib/screens/field_officer_dashboard.dart#L33) | [auditra/lib/screens/field_officer_dashboard.dart#L385](auditra/lib/screens/field_officer_dashboard.dart#L385) | [auditra/lib/screens/field_officer_dashboard.dart#L460](auditra/lib/screens/field_officer_dashboard.dart#L460) | [auditra/lib/screens/field_officer_dashboard.dart#L507](auditra/lib/screens/field_officer_dashboard.dart#L507) | [auditra/lib/screens/field_officer_dashboard.dart#L524](auditra/lib/screens/field_officer_dashboard.dart#L524) and [auditra/lib/screens/field_officer_dashboard.dart#L541](auditra/lib/screens/field_officer_dashboard.dart#L541) |

Quick explanation:

- Both web and Flutter use the same backend attendance APIs.
- UI actions are different files, but business rules are enforced in backend.

### Web Attendance Page

Frontend:

[auditra web app/src/pages/shared/MyAttendance.jsx#L13](auditra%20web%20app/src/pages/shared/MyAttendance.jsx#L13)

### Backend Attendance APIs

| Function | File |
|---|---|
| Check in | [backend/attendance/views.py#L39](backend/attendance/views.py#L39) |
| Leave early | [backend/attendance/views.py#L110](backend/attendance/views.py#L110) |
| Check out | [backend/attendance/views.py#L166](backend/attendance/views.py#L166) |
| Start overtime | [backend/attendance/views.py#L221](backend/attendance/views.py#L221) |
| End overtime | [backend/attendance/views.py#L295](backend/attendance/views.py#L295) |
| Today attendance status | [backend/attendance/views.py#L353](backend/attendance/views.py#L353) |
| Personal summary | [backend/attendance/views.py#L427](backend/attendance/views.py#L427) |
| HR summary | [backend/attendance/views.py#L714](backend/attendance/views.py#L714) |

### Attendance Rules

Working hours logic:

[backend/attendance/models.py#L65](backend/attendance/models.py#L65)

Overtime calculation:

[backend/attendance/models.py#L102](backend/attendance/models.py#L102)

Working day checking:

[backend/attendance/models.py#L179](backend/attendance/models.py#L179)

Important point to explain

Attendance rules are enforced in backend, not frontend.

So users cannot bypass rules by editing frontend.

### HR Attendance Summary Page

Frontend page:

[auditra web app/src/pages/hr/AttendanceSummary.jsx#L1](auditra%20web%20app/src/pages/hr/AttendanceSummary.jsx#L1)

Shared component:

[auditra web app/src/components/AttendanceSummaryView.jsx#L13](auditra%20web%20app/src/components/AttendanceSummaryView.jsx#L13)

Backend summary API:

[backend/attendance/views.py#L714](backend/attendance/views.py#L714)

### Mobile Attendance Flow

Main dashboard:

[auditra/lib/screens/field_officer_dashboard.dart#L33](auditra/lib/screens/field_officer_dashboard.dart#L33)

### Attendance Actions

| Action | Line |
|---|---|
| Check in | [auditra/lib/screens/field_officer_dashboard.dart#L385](auditra/lib/screens/field_officer_dashboard.dart#L385) |
| Leave early | [auditra/lib/screens/field_officer_dashboard.dart#L460](auditra/lib/screens/field_officer_dashboard.dart#L460) |
| Checkout | [auditra/lib/screens/field_officer_dashboard.dart#L507](auditra/lib/screens/field_officer_dashboard.dart#L507) |
| Start OT | [auditra/lib/screens/field_officer_dashboard.dart#L524](auditra/lib/screens/field_officer_dashboard.dart#L524) |
| End OT | [auditra/lib/screens/field_officer_dashboard.dart#L541](auditra/lib/screens/field_officer_dashboard.dart#L541) |

### Offline Sync

Storage:

[auditra/lib/services/offline_storage_service.dart#L333](auditra/lib/services/offline_storage_service.dart#L333)

Sync engine:

[auditra/lib/services/sync_engine.dart#L153](auditra/lib/services/sync_engine.dart#L153)

Important point

Mobile app can work offline.

Attendance actions are stored locally and synced later.

## 5. System Logs And Audit Trail

### Main Log Model

File:

[backend/system_logs/models.py#L64](backend/system_logs/models.py#L64)

### Hash Generation

File:

[backend/system_logs/models.py#L89](backend/system_logs/models.py#L89)

### Create Log Blocks

File:

[backend/system_logs/utils.py#L10](backend/system_logs/utils.py#L10)

### Verify Chain

File:

[backend/system_logs/utils.py#L33](backend/system_logs/utils.py#L33)

### Login Logging Middleware

File:

[backend/system_logs/middleware.py#L7](backend/system_logs/middleware.py#L7)

### Frontend System Logs Page

Page:

[auditra web app/src/pages/admin/SystemLogs.jsx#L274](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L274)

Load logs:

[auditra web app/src/pages/admin/SystemLogs.jsx#L302](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L302)

Verify chain button:

[auditra web app/src/pages/admin/SystemLogs.jsx#L318](auditra%20web%20app/src/pages/admin/SystemLogs.jsx#L318)

### Important Log Examples

| Action | File |
|---|---|
| `USER_LOGIN` | [backend/authentication/views.py#L106](backend/authentication/views.py#L106) and [backend/system_logs/middleware.py#L7](backend/system_logs/middleware.py#L7) |
| `PASSWORD_CHANGED` | [backend/authentication/views.py#L180](backend/authentication/views.py#L180) |
| `ROLE_ASSIGNED` | [backend/authentication/views.py#L343](backend/authentication/views.py#L343) |
| `USER_DELETE` | [backend/authentication/views.py#L421](backend/authentication/views.py#L421) |
| `ATTENDANCE_CHECK_IN` | [backend/attendance/views.py#L39](backend/attendance/views.py#L39) |

## 6. Django Admin Pages

These are not React pages.

This is Django built-in admin panel:

`/admin/`

| Admin feature | File |
|---|---|
| User admin | [backend/authentication/admin.py#L14](backend/authentication/admin.py#L14) |
| Role admin | [backend/authentication/admin.py#L30](backend/authentication/admin.py#L30) |
| Payment slip admin | [backend/authentication/admin.py#L38](backend/authentication/admin.py#L38) |
| Holiday admin | [backend/attendance/admin.py#L6](backend/attendance/admin.py#L6) |
| Attendance admin | [backend/attendance/admin.py#L14](backend/attendance/admin.py#L14) |
| System logs admin | [backend/system_logs/admin.py#L6](backend/system_logs/admin.py#L6) |

## 7. Easy Review Talking Points

Use these during presentation.

### Authentication

- JWT authentication is used
- Refresh tokens are handled automatically
- Backend validates roles

### Security

- Route protection exists in frontend
- Role checking exists in backend
- Audit logs track sensitive actions

### Attendance

- Rules are enforced server-side
- Working hours are calculated in backend
- Overtime is handled separately

### Mobile App

- Uses same APIs as web app
- Supports offline attendance
- Sync retries when internet returns

### System Logs

- Blockchain-like hash chaining
- Detects tampering
- Verification is available from admin page

## 8. Quick Answer Section

Very useful in viva.

| Instructor question | Answer |
|---|---|
| Where are routes? | [auditra web app/src/App.jsx#L145](auditra%20web%20app/src/App.jsx#L145) |
| Where is login backend? | [backend/authentication/views.py#L106](backend/authentication/views.py#L106) |
| Where are roles assigned? | [backend/authentication/views.py#L343](backend/authentication/views.py#L343) |
| Where is attendance check-in? | [backend/attendance/views.py#L39](backend/attendance/views.py#L39) |
| Where is overtime logic? | [backend/attendance/models.py#L102](backend/attendance/models.py#L102) |
| Where are logs created? | [backend/system_logs/utils.py#L10](backend/system_logs/utils.py#L10) |
| Where is hash verification? | [backend/system_logs/utils.py#L33](backend/system_logs/utils.py#L33) |
| Where is offline sync? | [auditra/lib/services/sync_engine.dart#L153](auditra/lib/services/sync_engine.dart#L153) |
| Where is token refresh? | [auditra web app/src/api/axiosClient.js#L31](auditra%20web%20app/src/api/axiosClient.js#L31) |
| Where are admin routes? | [auditra web app/src/App.jsx#L145](auditra%20web%20app/src/App.jsx#L145) |

## 9. Small Corrections Worth Remembering

- Direct project approval backend lines are:
	approve at [backend/projects/views.py#L1366](backend/projects/views.py#L1366)
	reject at [backend/projects/views.py#L1433](backend/projects/views.py#L1433)
	pending list at [backend/projects/views.py#L1577](backend/projects/views.py#L1577)
- Employee hiring starts at [backend/authentication/views.py#L2468](backend/authentication/views.py#L2468), while role salary lookup is [backend/authentication/views.py#L2452](backend/authentication/views.py#L2452)
- System log verification logic is actually in [backend/system_logs/utils.py#L33](backend/system_logs/utils.py#L33), while the API wrapper is [backend/system_logs/views.py#L55](backend/system_logs/views.py#L55)
