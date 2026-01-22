# Knowledge Transfer Guide - UI Capture System

**Last Updated**: November 27, 2025  
**Purpose**: Help new developers understand the codebase quickly

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [File-by-File Guide](#file-by-file-guide)
5. [Key Concepts](#key-concepts)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

### What Does This Do?

This is an **AI-powered browser automation** system that:
- Takes a task in plain English (e.g., "Create a new project in Linear")
- Opens a web browser
- Uses AI to figure out what buttons to click
- Takes screenshots at each step
- Generates a report showing how the task was completed

### Real-World Use Cases

1. **Documentation**: Auto-generate "How-To" guides for internal tools
2. **Testing**: Verify workflows work across web apps
3. **Training**: Create visual step-by-step tutorials
4. **Process Discovery**: Document how users accomplish tasks

---

## 🚀 Quick Start

### Running the System

```bash
# Interactive mode (will prompt for task)
python main.py

# With task specified
python main.py --task "Create a project in Linear"

# With specific URL
python main.py --task "Filter items" --start-url "https://app.notion.so"

# With authentication
python main.py --task "Create issue" --login-email "you@company.com"
```

### First Time Setup

1. **Install dependencies**: `pip install -r requirements.txt`
2. **Set up .env file** (copy from .env.example):
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   LOGIN_EMAIL=your-email@company.com
   LOGIN_PASSWORD=your-password
   ```
3. **Run**: `python main.py`

---

## 🏗️ Architecture

### High-Level Flow

```
User Input (Task)
    ↓
main.py (Parse task, extract app name/URL)
    ↓
WorkflowEngine (Orchestrator)
    ├── PlannerAgent (AI: Break task into steps)
    ├── BrowserManager (Control Chrome/browser)
    ├── VisionAgent (AI: Analyze screenshots, decide actions)
    ├── AuthManager (Handle logins)
    └── ScreenshotAnalyzer (Generate reports)
    ↓
Output (Screenshots + HTML Report)
```

### Component Relationships

```
┌─────────────────────────────────────┐
│     WorkflowEngine (The Brain)      │
│  Coordinates everything below       │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
┌─────▼────┐  ┌────▼────────┐
│ Browser  │  │ AI Agents   │
│ Manager  │  │ - Planner   │
│          │  │ - Vision    │
└──────────┘  └─────────────┘
      │             │
      └──────┬──────┘
             │
        ┌────▼────┐
        │ Actions │
        │ - Click │
        │ - Type  │
        │ - Wait  │
        └─────────┘
```

---

## 📁 File-by-File Guide

### 🎬 Entry Point

#### `main.py` (163 lines)
**What it does**: Starting point of the application  
**Key functions**:
- `parse_args()`: Handles command-line arguments
- `main()`: Main execution flow

**Flow**:
1. Get task from user (command-line or interactive)
2. Extract app name and URL from task
3. Load credentials from .env or prompt
4. Initialize all components (browser, AI agents, workflow engine)
5. Execute task via WorkflowEngine

**When to modify**: Adding new command-line flags, changing startup behavior

---

### 🧠 Core Orchestration

#### `workflow/workflow_engine.py` (749 lines) ⭐ MOST IMPORTANT
**What it does**: The conductor that coordinates everything  
**Key methods**:

- **`run_task(task, app_name, start_url, login_url)`** (Line ~160)
  - Main entry point for executing a task
  - Creates run directory, sets up browser, calls planner
  - Loops through plan steps and executes them
  - Generates report at the end

- **`_evaluate_completion(page, task, app_name)`** (Line ~46)
  - Checks if task is complete
  - Looks for success indicators in page text
  - Returns: (completed: bool, partial: bool, reasons: list)
  - **Important**: This is strict - requires visible text + success message

- **`_detect_loop(action_history, window_size)`** (Line ~117)
  - Identifies when system is stuck
  - Checks for: same action repeated, same URL with no page change
  - Returns: (is_loop: bool, reason: str)
  - **Triggers**: Every 2 actions starting from 4 actions

**Step Types Handled**:
1. **navigate**: Go to start URL
2. **login**: Authenticate using AuthManager
3. **screenshot**: Capture current page state
4. **interact**: Click/type/fill based on Vision AI decision
5. **verify**: Check if task is complete

**Key Variables**:
- `action_history`: List of all actions taken (for loop detection)
- `loop_quit_checks`: Counter to prevent infinite loop detection loops
- `step_counter`: Current step number
- `task_completed`: Boolean flag when task is done

**When to modify**: 
- Changing workflow logic
- Adding new step types
- Modifying loop detection
- Adjusting completion criteria

---

### 🌐 Browser Control

#### `browser/browser_manager.py` (568 lines)
**What it does**: Controls the actual browser using Playwright  
**Key methods**:

- **`start()`** (Line ~50)
  - Launches Chrome browser
  - Uses persistent context (saves cookies/sessions)
  - Sets up popup detection event listener

- **`capture_screen(run_id, step_index)`** (Line ~113)
  - Takes screenshot
  - Dismisses overlays/popups first
  - Saves to: `captured_dataset/run_ID/step_N.png`

- **`execute_action(action_type, selector, value)`** (Line ~188)
  - Executes actions: click, type, keyboard, wait, scroll
  - Handles new tab detection
  - Validates action changed page (URL or DOM)
  - Returns: bool (success/failure)

- **`dismiss_overlays()`** (Line ~394)
  - Closes cookie banners, modals, popups
  - 6 strategies: cookies, escape key, close buttons, notifications, backdrops, high-z-index
  - Called before every screenshot

- **`smart_click_by_text(target_text)`** (Line ~327)
  - Fallback when selector fails
  - Finds button/link by visible text
  - More reliable than CSS selectors

**Browser State**:
- `self.page`: Current active page/tab
- `self.context`: Browser context (holds cookies, localStorage)
- `self.playwright`: Playwright instance

**When to modify**:
- Adding new action types
- Improving popup detection
- Changing browser settings

---

### 🤖 AI Agents

#### `agent/planner_agent.py` (188 lines)
**What it does**: AI that breaks tasks into steps  
**Key method**:
- **`plan_task(task, app_name, start_url)`**
  - Calls GPT-4 to create step-by-step plan
  - Returns JSON with steps: {type, name, description}
  - Step types: navigate, login, screenshot, interact, verify

**Example Plan**:
```json
{
  "steps": [
    {"step_number": 1, "type": "navigate", "name": "Open Linear"},
    {"step_number": 2, "type": "login", "name": "Log in"},
    {"step_number": 3, "type": "interact", "description": "Click 'New Project' button"},
    {"step_number": 4, "type": "verify", "description": "Check project was created"}
  ]
}
```

**When to modify**: Changing planning prompts, adding step types

---

#### `agent/vision_agent.py` (173 lines)
**What it does**: AI that "sees" screenshots and decides actions  
**Key method**:
- **`decide_next_action(screenshot_path, goal, observation, previous_actions)`**
  - Sends screenshot to GPT-4 Vision
  - Gets back action: {type, target_text, selector, value, reason}
  - Understands what's on screen and what to click next

**Action Types Returned**:
- `click`: Click a button/link
- `type`: Fill a text field
- `keyboard`: Press a key (Enter, Escape, etc.)
- `wait`: Wait for page to load
- `scroll`: Scroll page
- `done`: Task is complete

**Important Context Passed**:
- Current screenshot (base64)
- Goal/task description
- Previous actions (includes FAILED actions to avoid repetition)
- Current URL
- DOM summary

**When to modify**: Improving AI prompts, adding action types

---

### 🔐 Authentication

#### `browser/auth_manager.py` (899 lines)
**What it does**: Handles logging into web apps  
**Key method**:
- **`ensure_logged_in(page, login_url)`**
  - Detects if already logged in (looks for logout button)
  - If not, detects auth provider (Atlassian, Linear, Google OAuth)
  - Executes provider-specific login flow

**Supported Auth Providers**:
1. **Atlassian Identity** (Jira, Confluence)
2. **Linear OAuth**
3. **Google OAuth**
4. **Generic username/password forms**

**Detection Logic**:
```python
if "atlassian.com" in page.url:
    await _handle_atlassian_login(page)
elif "linear.app" in page.url:
    await _handle_linear_oauth(page)
elif "google.com" in page.url:
    await _handle_google_oauth(page)
else:
    await _generic_login(page)  # Try standard email/password fields
```

**When to modify**: Adding new auth providers, fixing login flows

---

### 📊 Reporting

#### `utils/screenshot_analyzer.py` (481 lines)
**What it does**: Generates HTML reports from screenshots  
**Key methods**:

- **`generate_narrative(dataset, task, run_dir)`**
  - Creates HTML report with all screenshots
  - Deduplicates similar screenshots
  - Generates transition explanations between steps
  - Outputs: `execution_report.html` and `.md` version

- **`deduplicate_screenshots(screenshots)`**
  - Uses perceptual hashing to find duplicate images
  - Threshold: 20 bits (configurable in config.py)
  - Keeps unique screenshots, marks duplicates

- **`_generate_transition_explanation(step1, step2, action)`**
  - Uses GPT-4 to explain what happened between two screenshots
  - Creates narrative: "After clicking X, the page showed Y"

**When to modify**: Changing report format, adjusting deduplication

---

### ⚙️ Configuration

#### `config.py` (92 lines)
**What it does**: Central configuration, loads from .env  
**Key settings**:

```python
# Directories
SCREENSHOT_DIR = "./captured_dataset"
USER_DATA_DIR = "./browser_session_data"

# Credentials
LOGIN_EMAIL = os.getenv("LOGIN_EMAIL")
LOGIN_PASSWORD = os.getenv("LOGIN_PASSWORD")

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL = "gpt-4o"

# App URL Mappings (extensible)
APP_URL_MAPPINGS = {
    "notion": "https://app.notion.so",
    "linear": "https://linear.app",
    "jira": "https://id.atlassian.com/login",
    # ... 20+ more apps
}

# Screenshot Settings
SCREENSHOT_DEDUPLICATION_ENABLED = True
SCREENSHOT_DEDUPLICATION_THRESHOLD = 20  # bits
SCREENSHOT_DELETE_DUPLICATES = False
```

**When to modify**: Adding new apps, changing defaults, adjusting AI settings

---

### 🛠️ Utilities

#### `utils/dom_parser.py` (142 lines)
**What it does**: Extracts interactive elements from HTML  
**Returns**: Summary of clickable/typeable elements for AI

#### `utils/input_parser.py` (183 lines)
**What it does**: Parses user task strings  
**Functions**:
- `extract_app_and_url(task)`: Finds app name and URL in task text
- `generate_url_from_app_name(app)`: Looks up app URL from config

#### `utils/logger.py` (55 lines)
**What it does**: Simple console logging with timestamps

#### `utils/file_utils.py` (35 lines)
**What it does**: JSON save/load helpers

---

## 🔑 Key Concepts

### 1. Action History & Loop Detection

**Problem**: AI can get stuck clicking the same button repeatedly  
**Solution**: Track all actions and detect patterns

```python
action_history = [
    {"type": "click", "target_text": "Projects", "url": "/projects", "page_changed": False},
    {"type": "click", "target_text": "Projects", "url": "/projects", "page_changed": False},
    {"type": "click", "target_text": "Projects", "url": "/projects", "page_changed": False},
]
# ↑ This triggers loop detection!
```

**Loop Detection Logic** (every 2 actions starting from 4):
1. Same action + same URL + no page change → LOOP
2. Only 2 unique actions in last 6 → LOOP
3. A-B-A-B alternating pattern → LOOP

When loop detected:
1. Take screenshot
2. Ask AI: "Should we continue or quit?"
3. AI decides based on screenshot analysis

---

### 2. Action Validation

**Problem**: Clicking doesn't always work (element hidden, wrong selector, etc.)  
**Solution**: Validate every action actually changed something

```python
# BEFORE action
url_before = page.url
dom_before = hash(page.content())

# Execute action
await page.click(selector)

# AFTER action
url_after = page.url
dom_after = hash(page.content())

# Validation
page_changed = (url_before != url_after) or (dom_before != dom_after)

if not page_changed:
    log("WARNING: Action had no effect!")
    action_marked_as_failed = True
```

This prevents false positives where action "succeeded" but did nothing.

---

### 3. Adaptive Cycles

**Problem**: Sometimes planned steps aren't enough  
**Solution**: Continue with AI-driven exploration after plan completes

```python
# After all planned steps...
if not task_completed:
    # Enter adaptive mode: let Vision AI explore freely
    for extra_cycles in range(12):  # Max 12 extra attempts
        - Take screenshot
        - Ask Vision AI: "What should I do next?"
        - Execute action
        - Check completion
        - If completed, stop
```

Adaptive cycles are more exploratory, less structured.

---

### 4. New Tab Detection

**Problem**: Clicking links can open new tabs  
**Solution**: Event-based detection and automatic switching

```python
# Set up listener BEFORE clicking
context.on("page", lambda new_page: handle_popup(new_page))

# Click
await page.click(selector)

# If new tab opened, handler automatically:
# 1. Detects it
# 2. Switches to it
# 3. Waits for load
```

This works better than polling for new tabs.

---

### 5. Completion Detection

**Problem**: How do we know task is done?  
**Solution**: Multi-factor verification

```python
def _evaluate_completion(page, task, app_name):
    # Get all visible text on page
    text = page.inner_text('body')
    
    # Requirement 1: Must have substantial content (not blank page)
    if len(text) < 100:
        return False
    
    # Requirement 2: Look for success indicators
    if "create" in task.lower():
        success = ("created successfully" in text or 
                   "has been created" in text)
        confirmation = ("confirmation" in url or "success" in url)
        
        return success AND confirmation  # Both required!
    
    # Similar logic for other task types (filter, search, etc.)
```

Strict verification prevents false completion.

---

## 🔧 Common Tasks

### Adding a New App to URL Mappings

**File**: `config.py`

```python
DEFAULT_APP_URL_MAPPINGS = {
    # ... existing apps ...
    "myapp": "https://myapp.com",  # Add here
}
```

Or in `.env`:
```bash
APP_URL_MAPPINGS='{"myapp": "https://myapp.com"}'
```

---

### Adding a New Auth Provider

**File**: `browser/auth_manager.py`

```python
async def ensure_logged_in(self, page, login_url):
    # Add detection
    if "myapp.com" in page.url:
        await self._handle_myapp_login(page)
    
# Add handler method
async def _handle_myapp_login(self, page):
    # 1. Wait for email field
    await page.fill("input[name='email']", self.email)
    # 2. Fill password
    await page.fill("input[name='password']", self.password)
    # 3. Click submit
    await page.click("button[type='submit']")
    # 4. Wait for dashboard
    await page.wait_for_url("**/dashboard")
```

---

### Debugging a Stuck Workflow

**Symptoms**: System keeps clicking same button  
**Check**:

1. **Look at logs**: Search for "LOOP DETECTED"
2. **Check screenshots**: Are they identical?
3. **Verify action validation**: Look for "page didn't change" warnings
4. **Check selector**: Is AI using correct element?

**Fix**:
- Adjust loop detection threshold in `workflow_engine.py`
- Improve Vision AI prompt to avoid repetition
- Add more specific selectors to DOM parser

---

### Changing AI Models

**File**: `config.py`

```python
LLM_MODEL = "gpt-4o"  # Change to gpt-4-turbo, gpt-4, etc.
```

Or `.env`:
```bash
LLM_MODEL=gpt-4-turbo
```

**Note**: GPT-4 Vision required for `VisionAgent`, regular GPT-4 for `PlannerAgent`

---

### Adjusting Screenshot Deduplication

**File**: `config.py`

```python
SCREENSHOT_DEDUPLICATION_THRESHOLD = 20  # bits

# Lower = stricter (only nearly identical)
# Higher = looser (more variation allowed)

# Recommended:
# 0-5: Identical only
# 6-15: Very similar
# 16-25: Similar (default: 20)
# 26+: Different
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "No OPENAI_API_KEY found"
**Fix**: Add to `.env`:
```bash
OPENAI_API_KEY=sk-your-key-here
```

#### 2. Browser won't start
**Fix**: Install Playwright browsers:
```bash
playwright install chromium
```

#### 3. Login keeps failing
**Cause**: Auth provider not detected  
**Fix**: Add provider to `auth_manager.py` or log in manually first time

#### 4. System stuck in loop
**Symptoms**: Same screenshot repeated  
**Fix**:
- Loop detection will eventually trigger
- Check if AI prompt needs improvement
- Verify action validation is working

#### 5. "Could not extract app name"
**Fix**: Mention app explicitly in task:
```bash
# BAD: "Create a project"
# GOOD: "Create a project in Linear"
```

#### 6. Screenshots are all duplicates
**Cause**: Deduplication threshold too low  
**Fix**: Increase `SCREENSHOT_DEDUPLICATION_THRESHOLD` in `config.py`

---

## 📚 Learning Path for New Developers

### Day 1: Understanding Flow
1. Read this entire document
2. Run `python main.py` with a simple task
3. Watch the browser and read console logs
4. Open generated HTML report

### Day 2: Code Walkthrough
1. Read `main.py` - understand entry point
2. Read `workflow/workflow_engine.py` - understand orchestration
3. Trace through one full task execution

### Day 3: Core Components
1. Read `browser/browser_manager.py` - browser control
2. Read `agent/vision_agent.py` - AI decision making
3. Read `agent/planner_agent.py` - task planning

### Day 4: Supporting Code
1. Read `browser/auth_manager.py` - authentication flows
2. Read `utils/screenshot_analyzer.py` - report generation
3. Read `config.py` - configuration

### Week 2: Make Changes
1. Add a new app to URL mappings
2. Improve a log message
3. Adjust loop detection threshold
4. Add a comment to unclear code

---

## 🤝 Contributing Guidelines

### Code Style
- Add comments for complex logic
- Use descriptive variable names
- Keep functions under 50 lines when possible
- Document all public methods

### Testing Changes
```bash
# 1. Test basic flow
python main.py --task "Test task" --app linear

# 2. Check syntax
python -m py_compile workflow/workflow_engine.py

# 3. Verify imports
python -c "import workflow.workflow_engine"
```

### Before Committing
1. Test with at least 2 different web apps
2. Check no hardcoded values added
3. Update this guide if adding major features
4. Add comments for complex logic

---

## 📞 Getting Help

### Resources
- **Code Comments**: Inline comments throughout codebase
- **This Document**: Architecture and concepts
- **LOOP_FIXES_REPORT.md**: Details on loop detection fixes
- **CODE_CLEANUP_REPORT.md**: Optimization and cleanup history

### Common Questions

**Q: Why does the system use two AI agents?**  
A: Planner creates structured plans (navigation, steps). Vision analyzes screenshots dynamically (what to click). Different strengths.

**Q: Can I run without OpenAI?**  
A: No, the system requires GPT-4 Vision for screenshot analysis. Local models don't have this capability yet.

**Q: How do I speed it up?**  
A: Use `gpt-4-turbo` model, reduce adaptive cycles in config, use headless mode.

**Q: Can it handle SPAs (React/Vue/Angular)?**  
A: Yes, action validation checks DOM changes, not just URL changes.

---

**End of Knowledge Transfer Guide**  
**Version**: 1.0  
**Last Updated**: November 27, 2025
