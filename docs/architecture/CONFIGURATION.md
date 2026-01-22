# Configuration Guide

## Zero Hardcodes Architecture

This project follows a **zero hardcodes** principle. All app-specific values are:
1. **Configurable** via environment variables
2. **Extensible** by users without code changes
3. **Optional** - direct URLs work without mappings

## App URL Mappings

### Default Mappings (config.py)

The system includes convenient URL mappings for common SaaS apps:
- `notion` → `https://app.notion.so`
- `linear` → `https://linear.app`
- `jira` → `https://id.atlassian.com/login`
- `github` → `https://github.com`
- And 20+ more...

### Custom Mappings (.env)

Add your own app mappings without modifying code:

```bash
# .env file
APP_URL_MAPPINGS='{"mycustomapp": "https://app.mycustomapp.com", "internaltools": "https://tools.company.com"}'
```

This **extends** the default mappings. If a key exists in both, your custom value wins.

### Direct URL Usage

You can always bypass mappings by providing direct URLs:

```bash
python3 main.py
# Enter: "Create a project on https://mycompany.atlassian.net"
```

## Authentication Provider Detection

### Why Auth Module Has App-Specific Logic

The `browser/auth_manager.py` contains URL pattern matching for auth providers:
- Atlassian Identity (Jira/Confluence)
- Linear OAuth
- Google OAuth
- Traditional username/password forms

**This is appropriate** because authentication systems differ by provider. It's similar to how OAuth libraries must know about GitHub, Google, Microsoft, etc.

### Adding New Auth Providers

To support additional authentication providers:

1. Add URL detection in `ensure_logged_in()`:
```python
if "myauth.com" in current_url:
    success = await self._try_myauth_login(page)
```

2. Implement the auth flow method:
```python
async def _try_myauth_login(self, page: Page) -> bool:
    # Your auth-specific logic
```

## Environment Variables

All configurable values:

```bash
# .env file

# Credentials
LOGIN_EMAIL=your@email.com
LOGIN_PASSWORD=yourpassword

# OpenAI
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o

# Storage paths
SCREENSHOT_DIR=./captured_dataset
USER_DATA_DIR=./browser_session_data
STORAGE_STATE_PATH=./storage_state.json

# Timeouts
TIMEOUT=10000

# Custom app mappings (optional)
APP_URL_MAPPINGS='{"app1":"url1","app2":"url2"}'
```

## Design Principles

✅ **Configurable**: All hardcodes moved to config.py with .env overrides  
✅ **Extensible**: Users add apps without touching code  
✅ **Generic**: Core workflow has zero app-specific logic  
✅ **Appropriate**: Auth module knows auth providers (functional requirement)  
✅ **LLM-Driven**: Planning and actions adapt to any application  

## Testing Custom Apps

```bash
# Using app name (requires mapping)
python3 main.py
# Enter: "Create a task in MyCustomApp"

# Using direct URL (no mapping needed)
python3 main.py
# Enter: "Create a task on https://tasks.mycompany.com"
```

Both approaches work identically!
