# UI Capture System - Backend API

Production-ready FastAPI backend for browser automation and workflow management.

## Quick Start

### 1. Setup

```bash
cd backend
chmod +x setup.sh
./setup.sh
```

### 2. Configure Environment

Update `.env` file with your settings:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ui_capture_db
SECRET_KEY=your-secret-key-here-change-in-production
REDIS_URL=redis://localhost:6379/0
```

### 3. Setup Database

Install and start PostgreSQL:

```bash
# macOS
brew install postgresql
brew services start postgresql

# Create database
psql postgres
CREATE DATABASE ui_capture_db;
\q
```

Initialize database tables:

```bash
source venv/bin/activate
python init_db.py
```

### 4. Start API Server

```bash
uvicorn app.main:app --reload --port 8000
```

API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (get access token)
- `GET /api/v1/auth/me` - Get current user

### Workflows
- `GET /api/v1/workflows/` - List all workflows
- `POST /api/v1/workflows/` - Create workflow
- `GET /api/v1/workflows/{id}` - Get workflow details
- `PUT /api/v1/workflows/{id}` - Update workflow
- `DELETE /api/v1/workflows/{id}` - Delete workflow

### Executions
- `GET /api/v1/executions/` - List all executions
- `POST /api/v1/executions/` - Create execution
- `GET /api/v1/executions/{id}` - Get execution details

## Architecture

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/
│   │   │   ├── auth.py       # Authentication endpoints
│   │   │   ├── workflows.py  # Workflow CRUD
│   │   │   └── executions.py # Execution management
│   │   └── router.py          # API router
│   ├── core/
│   │   ├── config.py          # Settings
│   │   ├── database.py        # Database connection
│   │   └── security.py        # JWT & password hashing
│   ├── models/
│   │   └── models.py          # SQLAlchemy models
│   ├── schemas/
│   │   └── schemas.py         # Pydantic schemas
│   └── main.py                # FastAPI application
├── requirements.txt
└── .env
```

## Database Models

### User
- email, username, password (hashed)
- is_active, is_superuser
- created_at, updated_at

### Workflow
- name, description, steps (JSON)
- status (active/paused/archived)
- owner_id (FK to User)
- created_at, updated_at

### Execution
- workflow_id (FK to Workflow)
- status (pending/running/success/failed/cancelled)
- started_at, completed_at
- error_message, result (JSON)

## Development

### Run with auto-reload:
```bash
uvicorn app.main:app --reload --port 8000
```

### Test API:
```bash
# Register user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=password123"
```

## Next Steps

1. ✅ Basic CRUD operations
2. 🔄 Connect to existing UI capture system
3. 🔄 Implement Celery task queue
4. 🔄 Add WebSocket for real-time updates
5. 🔄 Add monitoring and logging
6. 🔄 Add rate limiting
7. 🔄 Add API versioning
8. 🔄 Add comprehensive tests
