# UI State Capture System

An AI-powered browser automation framework that uses GPT-4 Vision to understand web interfaces, execute tasks, and generate comprehensive documentation of user workflows.

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📋 Table of Contents

- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Output & Reports](#output--reports)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Problem Statement

Modern web applications are becoming increasingly complex, and understanding user workflows is critical for:

- **Documentation Teams**: Creating accurate step-by-step guides
- **QA Engineers**: Recording test execution flows
- **Product Managers**: Understanding user journeys
- **Onboarding**: Training new team members on complex workflows
- **Automation**: Building datasets for AI/ML training

**The Challenge**: Manually documenting every click, form fill, and navigation is time-consuming, error-prone, and doesn't scale.

**Our Solution**: An intelligent system that:
1. Takes a natural language task description
2. Automatically executes the task in a real browser
3. Uses GPT-4 Vision to understand and navigate web UIs
4. Captures screenshots at every step
5. Generates comprehensive HTML reports with AI-explained workflows

---

## ✨ Key Features

### 🤖 AI-Powered Navigation
- **GPT-4 Vision Integration**: Understands web interfaces visually like a human
- **Natural Language Tasks**: Describe what you want in plain English
- **Intelligent Decision Making**: Plans multi-step workflows autonomously
- **Smart Form Filling**: Extracts specific values from task descriptions to auto-fill forms

### 🔐 Smart Authentication
- **Auto-Login**: Supports email/password and OAuth flows
- **Session Persistence**: Saves authentication state for future runs
- **reCAPTCHA Handling**: Automatically detects and clicks verification checkboxes
- **Multi-Provider Support**: Google OAuth, email/password, and more

### 🎨 Rich Output
- **Interactive HTML Reports**: Beautiful, detailed execution reports
- **Screenshot Deduplication**: Removes duplicate images automatically
- **AI Explanations**: Each step includes reasoning and context
- **JSON Manifests**: Programmatic access to execution data

### 🛡️ Robust Error Handling
- **Loop Detection**: Prevents infinite click cycles
- **Popup Management**: Auto-dismisses overlays, cookie banners, and modals
- **Iframe Support**: Handles OAuth popups and embedded content
- **Adaptive Recovery**: Automatically retries failed actions with alternatives

### 🚀 Developer-Friendly
- **Generic & Reusable**: Works with any web application
- **No App-Specific Code**: Fully generic automation approach
- **Configurable**: Extensive settings via `.env` file
- **Extensible Architecture**: Easy to add new capabilities

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                              │
│              "How do I create a project in Notion?"             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Main Entry Point (main.py)                  │
│  • Parse CLI arguments                                          │
│  • Load configuration from .env                                 │
│  • Initialize all components                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Workflow Engine (workflow_engine.py)           │
│  • Orchestrates entire execution                                │
│  • Manages task planning and step execution                    │
│  • Coordinates between all components                           │
└───┬───────────┬──────────────┬──────────────┬──────────────┬───┘
    │           │              │              │              │
    ▼           ▼              ▼              ▼              ▼
┌─────────┐ ┌────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────────┐
│ Planner │ │ Vision │ │   Browser   │ │   Auth   │ │  Screenshot │
│  Agent  │ │ Agent  │ │   Manager   │ │  Manager │ │  Analyzer   │
└─────────┘ └────────┘ └─────────────┘ └──────────┘ └─────────────┘
```

### Component Details

#### 1. **Workflow Engine** (`workflow/workflow_engine.py`)
- **Role**: Central orchestrator
- **Responsibilities**:
  - Task planning and execution
  - State management
  - Loop detection
  - Error recovery
  - Report generation coordination
- **Key Methods**:
  - `run_task()`: Main execution loop
  - `_detect_loop()`: Prevents infinite cycles
  - `_evaluate_completion()`: Determines success

#### 2. **Planner Agent** (`agent/planner_agent.py`)
- **Role**: High-level task planning
- **Responsibilities**:
  - Break down natural language tasks into steps
  - Generate structured execution plans
  - Classify step types (navigate, login, interact, verify, screenshot)
- **AI Model**: GPT-4
- **Input**: Task description + app name
- **Output**: Ordered list of steps with descriptions

#### 3. **Vision Agent** (`agent/vision_agent.py`)
- **Role**: Visual UI understanding
- **Responsibilities**:
  - Analyze screenshots to understand current page state
  - Decide next action (click, type, navigate, done)
  - Identify clickable elements and form fields
  - Explain reasoning for each decision
- **AI Model**: GPT-4 Vision
- **Input**: Screenshot + current goal + page context
- **Output**: Action with selector, target text, and reasoning

#### 4. **Browser Manager** (`browser/browser_manager.py`)
- **Role**: Browser control via Playwright
- **Responsibilities**:
  - Launch and manage browser sessions
  - Execute actions (click, type, navigate)
  - Capture screenshots
  - Dismiss overlays and popups
  - Handle iframes and new tabs
- **Key Features**:
  - Persistent browser contexts (session preservation)
  - Smart element locating (main page + iframes)
  - Popup detection and handling
  - Multi-strategy element finding

#### 5. **Auth Manager** (`browser/auth_manager.py`)
- **Role**: Authentication handling
- **Responsibilities**:
  - Detect login pages
  - Fill email/password forms
  - Handle reCAPTCHA
  - Manage session state
- **Supported Methods**:
  - Generic username/password
  - Registration forms
  - Cookie banner dismissal

#### 6. **Screenshot Analyzer** (`utils/screenshot_analyzer.py`)
- **Role**: Post-processing and reporting
- **Responsibilities**:
  - Screenshot deduplication (perceptual hashing)
  - Generate narrative descriptions
  - Create HTML/Markdown reports
  - Summarize execution flow
- **Features**:
  - Duplicate detection (20-bit threshold)
  - Auto-delete duplicates
  - Beautiful HTML reports with AI explanations

#### 7. **Supporting Utilities**
- **DOM Parser** (`utils/dom_parser.py`): Extract page structure
- **URL Validator** (`utils/url_validator.py`): Validate and cache URLs
- **Input Parser** (`utils/input_parser.py`): Parse user task input
- **Logger** (`utils/logger.py`): Centralized logging with masking
- **File Utils** (`utils/file_utils.py`): Image encoding, JSON handling

### Data Flow

```
1. User Task Input
   ↓
2. Planner Agent creates execution plan (GPT-4)
   ↓
3. For each step:
   a. Browser navigates/waits
   b. Screenshot captured
   c. Vision Agent analyzes (GPT-4 Vision)
   d. Action decided and executed
   e. State validated
   f. Loop detection runs
   ↓
4. Screenshot Analyzer processes images
   ↓
5. HTML/JSON reports generated
   ↓
6. Browser session preserved for next run
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Browser Automation | Playwright (Python) | Headful browser control |
| AI Planning | OpenAI GPT-4 | Task decomposition |
| AI Vision | OpenAI GPT-4 Vision | Screenshot analysis |
| Image Processing | Pillow + imagehash | Screenshot deduplication |
| HTML Parsing | BeautifulSoup4 | DOM extraction |
| Environment | python-dotenv | Configuration management |

---

## 📦 Prerequisites

- **Python 3.9 or higher**
- **OpenAI API Key** (with GPT-4 Vision access)
- **Operating System**: macOS, Linux, or Windows
- **Internet Connection** (for AI API calls)

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Pavan789bhanu/UI_State_Capture_System.git
cd UI_State_Capture_System
```

### Step 2: Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Install Playwright Browsers

```bash
playwright install chromium
```

---

## ⚙️ Configuration

### Create `.env` File

Create a `.env` file in the project root:

```bash
cp .env.example .env  # or create manually
```

### Required Environment Variables

```bash
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-actual-api-key-here

# Login Credentials (OPTIONAL - for auto-login)
LOGIN_EMAIL=your.email@example.com
LOGIN_PASSWORD=your_password_here

# Storage Paths (OPTIONAL - defaults provided)
SCREENSHOT_DIR=./captured_dataset
USER_DATA_DIR=./browser_session_data
STORAGE_STATE_PATH=./storage_state.json

# AI Model Settings (OPTIONAL)
OPENAI_MODEL=gpt-4o  # or gpt-4-turbo
OPENAI_VISION_MODEL=gpt-4o  # or gpt-4-vision-preview

# Screenshot Settings (OPTIONAL)
SCREENSHOT_DELETE_DUPLICATES=true
SCREENSHOT_DEDUPLICATION_THRESHOLD=20
```

### Configuration Options Explained

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | **Required** |
| `LOGIN_EMAIL` | Email for auto-login | None |
| `LOGIN_PASSWORD` | Password for auto-login | None |
| `SCREENSHOT_DIR` | Where screenshots are saved | `./captured_dataset` |
| `USER_DATA_DIR` | Browser session data | `./browser_session_data` |
| `SCREENSHOT_DELETE_DUPLICATES` | Remove duplicate images | `true` |
| `SCREENSHOT_DEDUPLICATION_THRESHOLD` | Perceptual hash threshold (0-64) | `20` |

---

## 📖 Usage

### Basic Usage (Interactive Mode)

```bash
python main.py
```

You'll be prompted to describe your task:
```
Please describe the task: How do I create a new board in Trello?
```

### With Task Specified

```bash
python main.py --task "Create a new project in Asana"
```

### With Custom URL

```bash
python main.py --task "Create a document" --start-url "https://www.notion.so"
```

### With Credentials Override

```bash
python main.py \
  --task "Add a task to Monday.com" \
  --login-email "user@company.com" \
  --login-password "SecurePass123"
```

### With Form Auto-Fill (NEW!)

The system now extracts specific values from your task description to auto-fill forms:

```bash
# Create a project with specific name and description
python main.py \
  --task "Create a project named 'Q4 Marketing Campaign' with description 'Holiday sales planning'"

# Add a task with specific details
python main.py \
  --task "Add issue titled 'Login Bug' with details 'Password reset not working'"

# Create meeting with specific agenda
python main.py \
  --task "Create meeting called 'Daily Standup' with agenda 'Sprint progress review'"
```

The system will extract the values in quotes and use them when filling matching form fields. See [FORM_AUTO_FILL.md](FORM_AUTO_FILL.md) for details.

### Command Line Options

```bash
python main.py [OPTIONS]

Options:
  --task TEXT              Task description (e.g., "Create a project")
  --start-url URL          Starting URL (auto-detected from task if not provided)
  --login-email EMAIL      Login email (overrides .env)
  --login-password PASS    Login password (overrides .env)
  --help                   Show help message
```

---

## 📁 Project Structure

```
ui_capture_system/
│
├── main.py                      # CLI entry point
├── config.py                    # Configuration loader
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (create this)
├── README.md                    # This file
│
├── agent/                       # AI Agents
│   ├── __init__.py
│   ├── planner_agent.py         # Task planning (GPT-4)
│   └── vision_agent.py          # Screenshot analysis (GPT-4 Vision)
│
├── browser/                     # Browser Control
│   ├── __init__.py
│   ├── browser_manager.py       # Playwright wrapper
│   └── auth_manager.py          # Authentication handling
│
├── workflow/                    # Orchestration
│   ├── __init__.py
│   └── workflow_engine.py       # Main execution engine
│
├── utils/                       # Utilities
│   ├── __init__.py
│   ├── dom_parser.py            # HTML parsing
│   ├── file_utils.py            # File operations
│   ├── input_parser.py          # Task input parsing
│   ├── logger.py                # Logging utility
│   ├── screenshot_analyzer.py   # Image processing & reports
│   └── url_validator.py         # URL validation & caching
│
├── captured_dataset/            # Generated output (created automatically)
│   └── run_TIMESTAMP/
│       ├── step_1.png           # Screenshots
│       ├── step_2.png
│       ├── execution_report.html # Interactive report
│       ├── execution_report.md   # Markdown summary
│       └── plan_execution_manifest.json # Raw data
│
├── browser_session_data/        # Browser persistence (created automatically)
│   ├── Default/
│   └── SingletonLock
│
└── tests/                       # Unit tests
    └── test_input_parser.py
```

---

## 🔍 How It Works

### Execution Flow

#### Phase 1: Planning
```python
# User provides task
task = "How do I create a project in Notion?"

# Planner Agent creates structured plan
plan = [
  {"type": "navigate", "description": "Go to Notion homepage"},
  {"type": "login", "description": "Log in to Notion"},
  {"type": "interact", "description": "Click 'New Project' button"},
  {"type": "interact", "description": "Fill project details"},
  {"type": "verify", "description": "Confirm project created"}
]
```

#### Phase 2: Execution Loop
```python
for step in plan:
    # 1. Navigate/Wait
    browser.navigate(url) or wait()
    
    # 2. Capture Screenshot
    screenshot = browser.capture_screen()
    
    # 3. Auto-Login Detection (if login page)
    if "login" in page.url:
        auto_fill_credentials()
        click_submit()
    
    # 4. Vision Agent Analyzes
    action = vision_agent.decide_next_action(
        screenshot=screenshot,
        goal=step.description
    )
    # Returns: {"type": "click", "target_text": "New Project", "reason": "..."}
    
    # 5. Execute Action
    browser.click(action.target_text)
    
    # 6. Validate State Changed
    if page_changed:
        success = True
    else:
        detect_loop()  # Prevent infinite retries
    
    # 7. Record Action
    action_history.append(action)
```

#### Phase 3: Post-Processing
```python
# 1. Deduplicate screenshots
unique_screenshots = analyzer.deduplicate_screenshots()

# 2. Generate narrative
narrative = analyzer.generate_narrative(action_history)

# 3. Create HTML report
analyzer.create_html_report(screenshots, narrative, action_history)

# 4. Save JSON manifest
save_json(execution_data, "plan_execution_manifest.json")
```

### Key Algorithms

#### Loop Detection
```python
# Check every 2 actions after step 4
if step > 4 and step % 2 == 0:
    recent_actions = action_history[-6:]
    
    # Pattern 1: Same action, no page change
    if count(same_action_no_effect) >= 3:
        log("LOOP DETECTED: Clicking same element repeatedly")
        trigger_recovery()
    
    # Pattern 2: Same URL, same screenshot
    if url_unchanged and screenshot_identical:
        log("LOOP DETECTED: No progress being made")
        trigger_adaptive_cycles()
```

#### Screenshot Deduplication
```python
# Perceptual hashing (imagehash library)
hash1 = imagehash.phash(image1, hash_size=8)
hash2 = imagehash.phash(image2, hash_size=8)

# Hamming distance comparison
difference = hash1 - hash2  # Number of differing bits

if difference <= THRESHOLD:  # Default: 20 bits
    delete_duplicate()
```

#### Smart Element Locating
```python
# Multi-strategy approach
def smart_click_by_text(text):
    # 1. Try main page
    for strategy in [button_role, link_role, text_search, xpath]:
        if element_found:
            click()
            return True
    
    # 2. Try all iframes (OAuth popups, etc.)
    for frame in page.frames:
        for strategy in [button_role, text_search, xpath]:
            if element_found:
                click()
                return True
    
    return False
```

---

## 📊 Output & Reports

### Directory Structure

Each run creates a timestamped directory:
```
captured_dataset/
└── run_1764348316/
    ├── step_3.png
    ├── step_4.png
    ├── step_5.png
    ├── execution_report.html   ← Open this in browser!
    ├── execution_report.md
    └── plan_execution_manifest.json
```

### HTML Report Features

- **Visual Timeline**: Screenshots with step numbers
- **AI Agent Explanations**: Why each action was taken
- **Action Details**: Target elements, selectors, reasoning
- **Statistics Dashboard**: Steps taken, success rate, duration
- **Modern Design**: Responsive, beautiful, interactive

### JSON Manifest

Programmatic access to execution data:
```json
{
  "task": "How do I create meetings in notion?",
  "app_name": "Notion",
  "start_url": "https://www.notion.so",
  "timestamp": "2025-11-28T11:45:16.775598",
  "plan": [...],
  "actions": [...],
  "screenshots": [...],
  "task_completed": false,
  "total_steps": 15
}
```

---

## 🚀 Advanced Features

### Session Persistence

Browser sessions are saved automatically:
```bash
# First run: Login required
python main.py --task "Check Notion dashboard"
# System: Logs you in, saves session

# Second run: Auto-logged in
python main.py --task "Create a page in Notion"
# System: Reuses saved session, no login needed!
```

Session data stored in: `browser_session_data/`

### URL Caching

Validated URLs are cached for faster startups:
```json
// .url_cache.json
{
  "notion": {
    "url": "https://www.notion.so",
    "validated_at": "2025-11-28T11:43:36",
    "status_code": 200
  }
}
```

### Screenshot Deduplication

Automatically removes duplicate images:
```
Before: 15 screenshots (2.3 MB)
After:  8 screenshots (1.1 MB)
Saved: 1.2 MB (52% reduction)
```

### reCAPTCHA Handling

Automatically detects and clicks "I'm not a robot":
```python
# Auto-detects reCAPTCHA iframes
# Finds checkbox inside iframe
# Clicks and waits for validation
# Continues with form submission
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Browser Lock Error
```
ERROR: Failed to create a ProcessSingleton for your profile directory
```

**Solution:**
```bash
rm -rf browser_session_data/SingletonLock
rm -rf browser_session_data/SingletonSocket
# Or: pkill -9 Chromium
```

#### 2. OpenAI API Errors
```
ERROR: Invalid API key
```

**Solution:**
- Verify your API key in `.env`
- Ensure you have GPT-4 Vision access
- Check API usage limits

#### 3. Element Not Found
```
FAILED: smart_click: no match for 'Submit'
```

**Solution:**
- Page may still be loading (wait 5 seconds is automatic)
- Element might be in an iframe (now supported)
- Try different task phrasing

#### 4. Login Failures
```
Could not find email input field
```

**Solution:**
- Verify credentials in `.env` file
- Some sites may require manual login first time
- Check for CAPTCHA requirements

### Debug Mode

Enable detailed logging:
```python
# In utils/logger.py, the log function already masks sensitive data
# All logs go to stdout by default
```

### Get Help

- **Issues**: https://github.com/Pavan789bhanu/UI_State_Capture_System/issues
- **Discussions**: https://github.com/Pavan789bhanu/UI_State_Capture_System/discussions

---

## 🤝 Contributing

Contributions are welcome! Here's how to help:

### Reporting Bugs

1. Check existing issues
2. Create new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Feature Requests

1. Open an issue with `[Feature Request]` tag
2. Describe the use case
3. Explain why it's useful

### Pull Requests

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `pytest tests/`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

### Development Setup

```bash
# Install dev dependencies
pip install -r requirements-dev.txt  # If exists

# Run tests
pytest tests/

# Format code
black .

# Lint
pylint **/*.py
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** - GPT-4 and GPT-4 Vision APIs
- **Playwright** - Powerful browser automation
- **BeautifulSoup** - HTML parsing
- **Pillow & imagehash** - Image processing

---

## 📞 Contact

**Project Maintainer**: Pavan Kumar Malasani

- GitHub: [@Pavan789bhanu](https://github.com/Pavan789bhanu)
- Repository: [UI_State_Capture_System](https://github.com/Pavan789bhanu/UI_State_Capture_System)

---

## 🗺️ Roadmap

### Future Enhancements

- [ ] **Multi-browser support** (Firefox, Safari)
- [ ] **Video recording** of entire workflow
- [ ] **Screenshot annotations** with bounding boxes
- [ ] **API mode** for programmatic usage
- [ ] **Docker containerization**
- [ ] **CI/CD integration** for automated testing
- [ ] **Custom action plugins** system
- [ ] **Multi-language support** for reports
- [ ] **Performance metrics** dashboard
- [ ] **Webhook notifications** on completion

---

## ⭐ Star History

If you find this project useful, please consider giving it a star on GitHub!

---

**Built with ❤️ by the community**
