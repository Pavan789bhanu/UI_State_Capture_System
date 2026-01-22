# 🎯 Quick Start Guide - UI Capture System

Get the complete system running in **5 minutes**!

## Prerequisites Check

Make sure you have:
- ✅ Python 3.8+ installed
- ✅ Node.js 16+ installed
- ✅ PostgreSQL 13+ installed
- ✅ Claude API key (for vision features)

## Step 1: Start Frontend (2 minutes)

```bash
# Open Terminal 1
cd /Users/pavankumarmalasani/Downloads/ui_capture_system/frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

**Result**: Frontend running at http://localhost:5174 ✅

## Step 2: Setup Backend (2 minutes)

```bash
# Open Terminal 2
cd /Users/pavankumarmalasani/Downloads/ui_capture_system/backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Create .env file (first time only)
cp .env.example .env

# Important: Update .env with your settings
# For quick start, you can use SQLite instead of PostgreSQL:
# DATABASE_URL=sqlite:///./ui_capture.db
nano .env
```

Update `.env`:
```env
DATABASE_URL=sqlite:///./ui_capture.db
SECRET_KEY=change-this-in-production-use-random-string
ALLOWED_ORIGINS=http://localhost:5174
```

```bash
# Initialize database (first time only)
python init_db.py

# Start API server
uvicorn app.main:app --reload --port 8000
```

**Result**: Backend running at http://localhost:8000 ✅
- API Docs: http://localhost:8000/docs

## Step 3: Test the System (1 minute)

### Option A: Using the Web UI

1. **Open browser**: http://localhost:5174
2. **View Dashboard**: See stats and workflows
3. **Browse pages**: Click on Workflows, Executions, Analytics

### Option B: Using API

```bash
# Register a user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "username": "demo",
    "password": "demo123"
  }'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=demo&password=demo123"
```

**Result**: User created and authenticated ✅

## 🎉 You're Ready!

Your production-ready UI Capture System is now running with:
- ✅ Modern React frontend with dashboard
- ✅ FastAPI backend with authentication
- ✅ SQLite database (or PostgreSQL if configured)
- ✅ Full CRUD operations
- ✅ Beautiful UI with TailwindCSS

## Next Steps

### Connect Frontend to Backend

1. **Create API client** in frontend:
```bash
cd frontend/src
mkdir api
```

2. **Test authentication flow**
3. **Replace mock data with real API calls**
4. **Add error handling and loading states**

### Enable Advanced Features

1. **PostgreSQL Setup** (for production):
```bash
# Install PostgreSQL
brew install postgresql
brew services start postgresql

# Create database
psql postgres
CREATE DATABASE ui_capture_db;
\q

# Update backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ui_capture_db

# Reinitialize database
python backend/init_db.py
```

2. **Redis Setup** (for background tasks):
```bash
brew install redis
brew services start redis
```

3. **Core System** (for actual automation):
```bash
# Install core dependencies
pip install -r requirements.txt

# Set up Claude API key in .env
ANTHROPIC_API_KEY=your-key-here

# Run automation
python main.py
```

## Troubleshooting

### Frontend Issues

**Port 5173 in use?**
```bash
# Kill process on port
lsof -ti:5173 | xargs kill -9
# Or just use 5174 (Vite auto-switches)
```

**Dependencies not installing?**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Backend Issues

**SQLite permission error?**
```bash
chmod 666 ui_capture.db
```

**Import errors?**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

**Database error?**
```bash
rm ui_capture.db  # Delete old database
python init_db.py  # Recreate
```

### CORS Issues

Update `backend/.env`:
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000
```

## Directory Structure

```
ui_capture_system/
├── frontend/           ← React UI (Port 5174)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   └── package.json
│
├── backend/            ← FastAPI (Port 8000)
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   └── main.py
│   └── requirements.txt
│
└── [core system files]
```

## Development Workflow

### Terminal 1 - Frontend
```bash
cd frontend
npm run dev
# Edit files in src/
# Changes auto-reload
```

### Terminal 2 - Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
# Edit files in app/
# Changes auto-reload
```

### Terminal 3 - Testing
```bash
# Test API
curl http://localhost:8000/health

# Test frontend
open http://localhost:5174
```

## Useful Commands

### Frontend
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run linter
```

### Backend
```bash
uvicorn app.main:app --reload              # Dev mode
uvicorn app.main:app --host 0.0.0.0        # Production
python init_db.py                          # Reset database
alembic upgrade head                       # Run migrations
```

## Resources

- **API Documentation**: http://localhost:8000/docs
- **Frontend**: http://localhost:5174
- **Project Docs**: See docs/ folder
- **Production Roadmap**: PRODUCTION_ROADMAP.md

## Support

- Check logs in terminal output
- API errors: See backend console
- Frontend errors: Check browser console (F12)
- Database issues: Check init_db.py output

---

**🚀 Happy automating!**
