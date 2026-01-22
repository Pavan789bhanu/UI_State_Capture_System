# Quick Start Guide - Backend Integration

## 🚀 Current Status
Backend restructuring is **95% complete**. All automation code has been moved to `backend/app/automation/`, imports have been updated, and services layer has been created.

## ⚡ Quick Setup (5 minutes)

### Step 1: Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
```

### Step 2: Set Environment Variables
Create `backend/.env` file:
```bash
OPENAI_API_KEY=your_openai_api_key_here
LOGIN_EMAIL=your_test_email@example.com
LOGIN_PASSWORD=your_test_password
```

### Step 3: Initialize Database
```bash
cd backend
python -c "from app.core.database import engine, Base; from app.models import models; Base.metadata.create_all(bind=engine); print('Database created!')"
```

### Step 4: Test Imports (Optional but Recommended)
```bash
cd backend
python -c "from app.automation.workflow.workflow_engine import WorkflowEngine; print('✅ Imports working!')"
```

### Step 5: Start Backend Server
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Server should start at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Step 6: Update Frontend API URL
In `frontend/src/lib/api.ts`, change:
```typescript
const API_BASE_URL = 'http://localhost:8000/api/v1';
```

### Step 7: Start Frontend
```bash
cd frontend
npm install  # if not already done
npm run dev
```

## 🧪 Testing the Integration

### Test 1: Check API Health
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### Test 2: Check WebSocket
Open browser console and run:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### Test 3: Create a Workflow
```bash
# Register a user first
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"testpass123"}'

# Login to get token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' | jq -r .access_token)

# Create workflow
curl -X POST http://localhost:8000/api/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Login",
    "description": "Test workflow to login to a site",
    "steps": {
      "task": "Go to example.com and take a screenshot",
      "app_name": "example.com",
      "url": "https://example.com"
    },
    "status": "draft"
  }'

# Execute workflow (replace 1 with actual workflow_id from above response)
curl -X POST http://localhost:8000/api/v1/workflows/1/execute \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: Full UI Test
1. Open frontend at http://localhost:3000
2. Register/Login
3. Go to Workflows page
4. Click "Create Workflow"
5. Enter:
   - Name: "Google Search Test"
   - Description: "Search for AI on Google"
   - Task: "Go to google.com, search for 'AI', and take a screenshot"
6. Click Execute
7. Watch real-time updates via WebSocket
8. View screenshots in `backend/data/screenshots/<run_id>/`

## 📁 Important Directories

- **Screenshots**: `backend/data/screenshots/<run_id>/`
- **Browser Data**: `backend/data/browser_data/`
- **Database**: `backend/data/ui_capture.db`
- **Reports**: `backend/data/screenshots/<run_id>/execution_report.html`

## 🔧 Troubleshooting

### Import Errors
```bash
# Make sure you're in backend/ directory
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python -c "from app.automation.workflow.workflow_engine import WorkflowEngine"
```

### Database Errors
```bash
cd backend
rm -f data/ui_capture.db  # Delete old database
# Re-create database (see Step 3 above)
```

### Playwright Not Found
```bash
playwright install chromium
# If still fails, try:
python -m playwright install chromium
```

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
# Or use different port
uvicorn app.main:app --reload --port 8001
```

### OpenAI API Errors
Make sure `.env` file has valid `OPENAI_API_KEY`:
```bash
cat backend/.env | grep OPENAI
# Should show: OPENAI_API_KEY=sk-...
```

## 📊 Architecture Overview

```
Frontend (React + TypeScript)
    ↓ HTTP/WebSocket
Backend (FastAPI)
    ↓
API Endpoints (workflows.py, executions.py)
    ↓
Services Layer (workflow_executor.py)
    ↓
Automation Engine (workflow_engine.py)
    ↓
Browser (Playwright) + AI (GPT-4 Vision)
```

## 🎯 What Happens When You Execute a Workflow

1. **Frontend** sends POST to `/api/v1/workflows/{id}/execute`
2. **API endpoint** creates execution record in database
3. **Background task** calls `execute_workflow()` service
4. **Workflow Executor** initializes:
   - BrowserManager (Playwright)
   - VisionAgent (GPT-4 Vision)
   - PlannerAgent (Task decomposition)
   - AuthManager (Login handling)
5. **WorkflowEngine** runs task:
   - Plans steps with LLM
   - Opens browser
   - Executes each step
   - Captures screenshots
   - Verifies completion
6. **WebSocket** broadcasts real-time updates
7. **Screenshots** saved to disk
8. **HTML report** generated with narrative
9. **Database** updated with execution results
10. **Frontend** displays results

## 🌟 Key Features Now Working

✅ Natural language task execution ("Login to example.com")
✅ GPT-4 Vision understands UI and decides actions
✅ Automatic form filling and login
✅ Screenshot capture and deduplication
✅ Real-time progress updates via WebSocket
✅ HTML reports with execution narrative
✅ Persistent browser sessions (cookies saved)
✅ Loop detection prevents infinite cycles
✅ Task completion verification
✅ Multiple workflow management
✅ Execution history tracking

## 📝 Example Workflows You Can Try

1. **Google Search**:
   - Task: "Go to google.com, search for 'OpenAI GPT-4', click the first result"
   
2. **Login Test**:
   - Task: "Go to github.com and login with provided credentials"
   
3. **Navigation**:
   - Task: "Go to wikipedia.org, search for 'Artificial Intelligence', take screenshots"

4. **Form Fill**:
   - Task: "Go to example.com/contact, fill out the contact form with test data"

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ Backend starts without import errors
- ✅ Frontend connects to backend API
- ✅ WebSocket connection establishes
- ✅ Can create workflows via UI
- ✅ Can execute workflows
- ✅ Browser launches and performs actions
- ✅ Screenshots appear in data/screenshots/
- ✅ HTML report is generated
- ✅ Execution status updates in UI

## 🚨 Common Issues

### "Module 'app' has no attribute 'automation'"
→ Make sure you're running from `backend/` directory and PYTHONPATH is set

### "Database is locked"
→ Another process is using SQLite. Close all connections or use PostgreSQL

### "Playwright not found"
→ Run `playwright install chromium`

### "No OpenAI API key"
→ Set `OPENAI_API_KEY` in `backend/.env`

### WebSocket won't connect
→ Check if backend is running on port 8000 and CORS is enabled

## 📞 Need Help?

Check these files for configuration:
- `backend/app/core/config.py` - All settings
- `backend/.env` - Environment variables
- `INTEGRATION_PROGRESS.md` - Detailed progress report
- `BACKEND_RESTRUCTURE.md` - Architecture decisions

## 🎯 Next Steps After Setup

1. **Add more workflows** - Create various automation tasks
2. **Monitor executions** - Check execution history and analytics
3. **View reports** - Open HTML reports in browser
4. **Customize settings** - Adjust timeouts, thresholds in config.py
5. **Scale up** - Add Celery for background jobs if needed
