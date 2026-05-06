# Auditra Backend

Django REST API backend for Auditra application.

## Setup Instructions

### 1. Install PostgreSQL
Make sure PostgreSQL is installed and running on your system.

### 2. Create Database
```bash
psql -U postgres
CREATE DATABASE auditra_db;
\q
```

### 3. Configure Environment Variables
Create a `.env` file in the backend directory with the following content:
```
DB_NAME=auditra_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser (Optional)
```bash
python manage.py createsuperuser
```

### 7. Run Server
```bash
python manage.py runserver
```

### One-command backend start (ASGI + Celery worker + Celery beat)
From the backend folder, run:
```powershell
./start_backend.ps1
```
This script activates the local `venv` and starts all three processes in separate PowerShell windows.

The API will be available at `http://localhost:8000/`

## API Endpoints

- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `GET /api/auth/profile/` - Get user profile (requires authentication)

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123","password2":"testpass123"}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

### Get Profile
```bash
curl -X GET http://localhost:8000/api/auth/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

