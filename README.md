# Auditra - Auditing & Valuation ERP

A full-stack application for property valuation and project management built with a Django REST API backend, React web dashboard, and Flutter mobile app.

## Architecture

```
Auditra/
├── backend/              # Django REST API (Python)
├── auditra web app/      # React web dashboard (Vite + MUI)
├── auditra/              # Flutter mobile app (Dart)
```

### Tech Stack

| Layer      | Technology                                                           |
|------------|----------------------------------------------------------------------|
| Backend    | Django 5.0, DRF, PostgreSQL, Django Channels (WebSockets), Celery   |
| Auth       | JWT (SimpleJWT), role-based access control                           |
| Real-time  | Redis, Django Channels, Firebase Cloud Messaging (FCM)              |
| Web App    | React 18, Vite, Material-UI 6, Recharts                             |
| Mobile App | Flutter 3.10+, Provider, Hive, web_socket_channel                   |
| Email      | SendGrid                                                             |

## User Roles

| Role              | Web App                 | Mobile App              |
|-------------------|-------------------------|-------------------------|
| Admin             | Full dashboard          | -                       |
| Coordinator       | Project management      | -                       |
| HR Head           | Leave & attendance mgmt | -                       |
| Accessor          | Project review          | -                       |
| Senior Valuer     | Valuation review        | -                       |
| MD/GM             | Project approval        | -                       |
| General Employee  | Attendance, leave, pay  | -                       |
| Client            | View assigned projects  | -                       |
| Agent             | View assigned projects  | -                       |
| Field Officer     | Attendance, leave, pay  | Projects & valuations   |

Field Officers use the **mobile app** for project work (site visits, valuations, photos, GPS) and the **web app** for employee functions (attendance, leave, payments).

All other roles use the **web app** exclusively.

## New Features (Feature Expansion)

### 1. Daily Standups Chat
- Per-project chat room (backend: `standups` Django app)
- Work-to-do / work-done message templates
- @mention available team members by name and role
- Real-time delivery via WebSocket

### 2. Field Officer Visit Scheduling
- FO can schedule a site visit date from mobile
- Client/agent/coordinator are notified via email + in-app notification
- Celery Beat sends daily reminders until the visit date

### 3. Unified Notifications
- Central `notifications` Django app with `notify()` service
- In-app WebSocket delivery (web) and FCM push (mobile)
- Role-based, personalized, categorized notifications
- Dedicated Notifications page on web and mobile

### 4. Mobile Offline Sync & Bug Fixes
- `SyncEngine.init()` called at app startup
- Sync statuses: **Queued → Syncing → Synced / Failed**
- Auto sync on network restore via connectivity_plus
- `password_change_required` properly propagated from login response
- Global Flutter error handler (`ErrorReporter`)

### 5. Admin Dashboard KPIs
- Projects completed within deadlines (per employee, per month)
- Average jobs completed per employee and time taken
- New clients engaged monthly
- Overall project status (by month, quarter, year) — bar & line charts

### 6. Invitation Tracking
- `Invitation` model auto-created when client/agent/employee accounts are generated
- First-login forced password change gate
- Admin Invitations tab (`/dashboard/invitations`)

### 7. Landing Page Email Validation
- Public `/auth/public/check-email/` endpoint (rate-limited)
- Debounced real-time check on Client and Employee registration forms
- Error shown if email already used for a different role

### 8. Priority Color Tags
- `getPriorityColor` / `getPriorityBgColor` in `helpers.js`
- `AppColors.priorityColor()` / `priorityBgColor()` in Flutter theme
- High=Red, Medium=Orange, Low=Green

### 9. Mobile Report Metadata & Photo Management
- Auto-capture timestamp, GPS coordinates, device ID on each valuation
- Image compression via `flutter_image_compress` before upload
- Mark primary photo; drag-to-reorder API on backend

### 10. Similar Item Suggestions
- Backend: `catalog` Django app with `ItemCatalog`, pluggable providers
- Mobile: `ItemSuggestionsWidget` — shows suggestions with confidence scores
- FO can confirm, edit, reject or create new item manually

### 11. Document Visibility
- `ProjectDocument.visible_to` ManyToMany field
- Coordinator selects viewers when uploading (multi-select dialog)
- Backend queryset filters documents by visible_to list

### 12. Depreciation Calculation (Mobile)
- Straight-line, diminishing balance, units-of-production methods
- Default rates from `DepreciationPolicy` system tables
- Override with reason option
- `DepreciationWidget` embedded in valuation form

### 13. One Combined Report Per Project
- `reports` Django app: `ProjectReport`, `ValuationItem`, `ValuationItemPhoto`
- Duplicate item detection (merge or create new)
- Server-side combined PDF via ReportLab
- Conflict resolution: 409 response + optimistic locking on PUT

### 14. Offline-First Sync
- Sync status labels: Queued (0), Syncing (2), Synced (1), Failed (3)
- `SyncStatusWidget` visible on dashboard
- Auto background sync on network reconnect
- `updateValuationSyncStatus()` tracks per-item state

### 15. Leave Management Enhancements
- Half-day leave requests (morning/afternoon)
- `LeavePolicy` + `LeaveBalance` models for quota tracking
- Salary deduction automatically flagged on `PaymentSlip` for excess leave
- Employee can cancel approved leave before start date → HR notified

### 16. User Profile
- `UserProfile` model (avatar, theme, bio, phone, timezone)
- Full Profile page on web and mobile
- Theme toggle (light/dark/system) persisted server-side and in SharedPreferences
- `UserAvatar` component used system-wide on web
- Profile icon in mobile app bar for all roles

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (for WebSocket channels + Celery)
- Flutter SDK 3.10+ (for mobile development)

### 1. Database Setup

```sql
CREATE DATABASE auditra_db;
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment (see Environment Variables)
# Run migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start ASGI server (Channels / WebSocket support)
daphne auditra_backend.asgi:application

# Start Celery worker (background tasks)
celery -A auditra_backend worker -l info --pool=solo

# Start Celery Beat scheduler (reminders)
celery -A auditra_backend beat -l info
```

The API will be available at `http://localhost:8000/api/`.

### Running backend tests

From the `backend/` directory, with the virtual environment activated and dependencies installed, run the Django test suite with `manage.py test`.

```bash
cd backend
venv\Scripts\activate        # Windows
# source venv/bin/activate     # macOS / Linux

## Running All Services

```bash
# Terminal 1 – Backend (ASGI)
cd backend && daphne auditra_backend.asgi:application

# Terminal 2 – Celery worker
cd backend && celery -A auditra_backend worker -l info --pool=solo

# Terminal 3 – Celery Beat
cd backend && celery -A auditra_backend beat -l info

# Terminal 4 – Web App
cd "auditra web app" && npm run dev
```

# Run all tests (discovers tests under each installed app’s tests/ package)
python manage.py test

# Run tests for one or more apps by app label
python manage.py test notifications
python manage.py test authentication catalog projects

# Typical full pass across main API apps (optional explicit list)
python manage.py test attendance authentication catalog notifications projects reports reports_v2 standups system_logs valuations

# More verbose output (test names and failures)
python manage.py test -v 2
```

Django uses a **separate test database** (usually named with a `test_` prefix) created from your `DATABASES` settings, then dropped when the run finishes. PostgreSQL must be running, and the DB user should be allowed to create databases. Other settings (e.g. `EMAIL_BACKEND` in tests) may be overridden by test cases so real emails are not sent.

### 3. Web App Setup

```bash
cd "auditra web app"
npm install
npm run dev
```

The web app will be available at `http://localhost:5173/`.

### 4. Mobile App Setup

```bash
cd auditra
flutter pub get
flutter run
```



## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Database
DB_NAME=auditra_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Django
SECRET_KEY=your-secret-key
DEBUG=True

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=your-email@example.com
FRONTEND_URL=http://localhost:5173

# Redis (Channels + Celery)
REDIS_URL=redis://localhost:6379/0

# Firebase (FCM push notifications)
FCM_CREDENTIALS_PATH=/path/to/firebase-credentials.json
```

## Django Apps

| App                 | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `authentication`    | Users, roles, leave, payments, removals, invitations, profile |
| `attendance`        | Check-in/out, summaries, overtime                             |
| `projects`          | Projects, assignments, documents, visits                      |
| `valuations`        | Valuations, photos, GPS data (legacy)                         |
| `notifications`     | Unified notification service, preferences, device tokens      |
| `standups`          | Per-project standup chat rooms and messages                   |
| `catalog`           | Item catalog, external sources, depreciation policies         |
| `reports`           | One-report-per-project, valuation items, combined PDF         |

## Key Data Models (New)

| Model                  | App             | Purpose                                            |
|------------------------|-----------------|----------------------------------------------------|
| `Notification`         | notifications   | Per-user notification records                      |
| `NotificationPreference`| notifications  | User channel preferences per category              |
| `DeviceToken`          | notifications   | FCM tokens for mobile push                         |
| `StandupRoom`          | standups        | Per-project chat room (1-to-1 with Project)        |
| `StandupMessage`       | standups        | Chat message with kind (work_to_do/work_done/free) |
| `StandupMention`       | standups        | @mention link between message and user             |
| `ProjectVisit`         | projects        | Scheduled field officer site visits                |
| `ItemCatalog`          | catalog         | Internal item reference library                    |
| `ExternalSource`       | catalog         | Config for external catalog HTTP providers         |
| `DepreciationPolicy`   | catalog         | Default rates per category and method              |
| `ProjectReport`        | reports         | One combined report per project                    |
| `ValuationItem`        | reports         | Normalised item in the new report structure        |
| `ValuationItemPhoto`   | reports         | Photo with GPS/timestamp/device metadata           |
| `Invitation`           | authentication  | Tracks auto-created account emails and status      |
| `UserProfile`          | authentication  | Avatar, theme, bio, timezone per user              |
| `LeavePolicy`          | authentication  | Annual quota per role and leave type               |
| `LeaveBalance`         | authentication  | Used-days tracker per user/year/type               |

## API Endpoints (New)

### Notifications (`/api/notifications/`)

| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/`                         | List notifications (paginated) |
| POST   | `/<id>/read/`               | Mark single read               |
| POST   | `/mark-all-read/`           | Mark all read                  |
| GET    | `/unread-count/`            | Unread count                   |
| GET/PUT| `/preferences/`             | Notification preferences       |
| POST   | `/device-tokens/`           | Register FCM token             |
| DELETE | `/device-tokens/<id>/`      | Unregister FCM token           |

### Standups (`/api/standups/`)

| Method | Endpoint                          | Description             |
|--------|-----------------------------------|-------------------------|
| GET    | `/<project_id>/messages/`         | List messages           |
| POST   | `/<project_id>/post/`             | Post message            |
| GET    | `/<project_id>/members/`          | List mentionable members|

### Catalog (`/api/catalog/`)

| Method | Endpoint                    | Description                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/suggestions/`             | Item suggestions with confidence  |
| POST   | `/items/<id>/confirm/`      | Confirm suggestion use            |
| POST   | `/depreciation/calculate/`  | Calculate depreciation            |
| GET    | `/depreciation/policies/`   | List depreciation policies        |

### Reports (`/api/reports/`)

| Method | Endpoint                                  | Description              |
|--------|-------------------------------------------|--------------------------|
| GET    | `/<project_id>/`                          | Get/create project report|
| POST   | `/<project_id>/submit/`                   | Submit + generate PDF    |
| GET/POST| `/<project_id>/items/`                   | List/create valuation items|
| PATCH  | `/<project_id>/items/<id>/`              | Update item              |
| POST   | `/<project_id>/items/<id>/merge/`        | Merge duplicate item     |
| GET/POST| `/<project_id>/items/<id>/photos/`       | Photos for item          |
| POST   | `/<project_id>/items/<id>/photos/reorder/`| Reorder photos          |

### WebSocket Endpoints

| Path                              | Description                   |
|-----------------------------------|-------------------------------|
| `ws://host/ws/notifications/`     | Per-user live notifications   |
| `ws://host/ws/standups/<project_id>/` | Per-project standup chat  |

All WebSocket connections authenticate via `?token=<jwt>` query parameter.


