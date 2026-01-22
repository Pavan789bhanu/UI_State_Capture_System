# Backend Restructuring Plan

## Current Issues
1. Two separate backend implementations (api_server.py and backend/app)
2. Automation modules (agent, browser, workflow, utils) at root level
3. No integration between API and automation engine
4. Missing WebSocket for real-time updates
5. Backend doesn't actually execute workflows

## Proposed Structure

```
ui_capture_system/
├── backend/                          # ✅ All backend code
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app with WebSocket
│   │   ├── core/
│   │   │   ├── config.py            # Settings & environment
│   │   │   ├── database.py          # SQLAlchemy setup
│   │   │   └── security.py          # Auth utilities
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── workflows.py  # Workflow CRUD + Execute
│   │   │       │   ├── executions.py # Execution tracking
│   │   │       │   ├── analytics.py  # Analytics endpoints
│   │   │       │   ├── auth.py       # Authentication
│   │   │       │   └── websocket.py  # WebSocket endpoint
│   │   │       └── router.py
│   │   ├── models/
│   │   │   └── models.py            # SQLAlchemy models
│   │   ├── schemas/
│   │   │   └── schemas.py           # Pydantic schemas
│   │   ├── services/                 # ✅ NEW: Business logic
│   │   │   ├── workflow_executor.py  # Execute workflows
│   │   │   └── websocket_manager.py  # Manage WS connections
│   │   └── automation/               # ✅ MOVED: Automation modules
│   │       ├── agent/
│   │       │   ├── vision_agent.py
│   │       │   └── planner_agent.py
│   │       ├── browser/
│   │       │   ├── browser_manager.py
│   │       │   └── auth_manager.py
│   │       ├── workflow/
│   │       │   └── workflow_engine.py
│   │       └── utils/
│   │           ├── dom_parser.py
│   │           ├── file_utils.py
│   │           ├── input_parser.py
│   │           ├── logger.py
│   │           ├── screenshot_analyzer.py
│   │           └── url_validator.py
│   ├── requirements.txt
│   └── README.md
├── frontend/                         # ✅ React UI
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/api.ts
│   │   └── ...
│   └── package.json
├── data/                             # Runtime data
├── captured_dataset/                 # Screenshots
├── browser_session_data/             # Browser cache
├── main.py                           # ✅ KEEP: CLI interface
├── config.py                         # ✅ KEEP: Shared config
└── README.md
```

## Migration Steps
1. Create backend/app/automation/ directory structure
2. Move agent/, browser/, workflow/, utils/ into backend/app/automation/
3. Update all imports to use new paths
4. Create workflow_executor.py service
5. Create websocket_manager.py service
6. Update API endpoints to use services
7. Add WebSocket endpoint
8. Update frontend API URLs
9. Test end-to-end integration

## Benefits
✅ Single, organized backend structure
✅ Clear separation: API ↔ Services ↔ Automation
✅ All automation code in one place
✅ Proper dependency injection
✅ Easy to test and maintain
✅ Production-ready structure
