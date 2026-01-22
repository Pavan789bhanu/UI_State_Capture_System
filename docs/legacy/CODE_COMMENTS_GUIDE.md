# Inline Code Comments Guide

This document provides human-friendly explanations for key sections of code throughout the project.

---

## workflow/workflow_engine.py

### Main Class Structure
```python
class WorkflowEngine:
    """The brain of the automation system.
    
    Think of this as a conductor orchestrating:
    - Browser (the instrument that plays notes)
    - AI Agents (the sheet music readers)
    - Auth Manager (the key signature)
    - Screenshots (the recording)
    """
```

### Key Method: run_task() (Line ~160)
```python
async def run_task(self, task, app_name, start_url, login_url):
    """Main workflow execution - this is where everything happens.
    
    FLOW:
    1. Create run directory for this execution (screenshots go here)
    2. Start browser and navigate to app
    3. Log in if needed
    4. Get step-by-step plan from Planner AI
    5. Loop through each step:
       - navigate → Go to URL
       - login → Authenticate
       - screenshot → Capture current state
       - interact → Click/type based on Vision AI
       - verify → Check if task complete
    6. If not complete, enter adaptive mode (AI explores freely)
    7. Generate HTML report
    8. Clean up browser
    
    IMPORTANT VARIABLES:
    - step_counter: Which step we're on (1, 2, 3...)
    - action_history: List of all actions taken (for loop detection)
    - loop_quit_checks: How many times we've asked AI if we're stuck
    - task_completed: Boolean flag when we're done
    """
    # Create unique run ID using current timestamp
    run_id = f"run_{int(time.time())}"
    
    # action_history tracks everything we do
    # Used by loop detection to catch repetitive patterns
    action_history: List[dict] = []
```

### Action Validation Pattern (Line ~335)
```python
# === CRITICAL: Capture state BEFORE action ===
# We need to verify the action actually did something
url_before = page.url
dom_before_hash = hash(await page.content())

# Execute the action (click, type, etc.)
action_executed = await self.browser.execute_action(...)

# === Check if anything changed ===
url_after = page.url
dom_after_hash = hash(await page.content())

# An action is only "successful" if page state changed
# Either URL changed (navigation) OR DOM changed (content updated)
page_changed = (url_after != url_before) or (dom_after_hash != dom_before_hash)

if action_executed and not page_changed:
    # Looks like we clicked nothing or a broken element
    log("WARNING: Action had no effect on page!")
    action_executed = False  # Mark as failed
```

### Loop Detection Logic (Line ~412)
```python
# === Check for loops every 2 actions starting from 4 ===
# Why? Catches stuck patterns early before wasting too many API calls
if len(action_history) >= 4 and len(action_history) % 2 == 0:
    is_loop, loop_reason = self._detect_loop(action_history, window_size=4)
    
    if is_loop and loop_quit_checks < 2:  # Max 2 quit checks to avoid infinite recursion
        # We're stuck! Ask AI if we should continue or give up
        loop_quit_checks += 1
        
        # Take screenshot for AI to analyze
        quit_screenshot = await self.browser.capture_screen(...)
        
        # Ask AI: "Are we stuck or making progress?"
        quit_decision = await self.vision_agent.decide_next_action(
            screenshot_path=quit_screenshot,
            goal="We're clicking same element repeatedly. Continue or quit?",
            ...
        )
        
        if quit_decision.get("type") == "done":
            # AI says we're truly stuck - give up gracefully
            break
```

### Completion Detection (Line ~46)
```python
def _evaluate_completion(self, page, task, app_name):
    """Check if task is complete by analyzing page content.
    
    STRICT REQUIREMENTS:
    1. Page must have substantial content (>100 chars visible text)
    2. Must find success indicators matching task type
    3. Must have confirmation context (URL or text)
    
    WHY STRICT? Prevents false positives like:
    - Clicking "Create" but form had validation errors
    - Navigating away before action completed
    - Modal closed but data not saved
    
    TASK PATTERNS:
    - "create/add/new" → Look for "created successfully" + confirmation URL
    - "filter/search" → Look for results display
    - "open/navigate" → Check URL contains relevant keywords
    """
    # Get all visible text from page (not HTML tags)
    visible_text = await page.evaluate("() => document.body.innerText")
    
    # Requirement 1: Must have real content (not blank/error page)
    if len(visible_text) < 100:
        return False, False, ["Page appears blank"]
    
    # Requirement 2 & 3: Task-specific verification
    if "create" in task.lower():
        has_success = "created successfully" in visible_text.lower()
        has_confirmation = "confirmation" in page.url.lower()
        
        # Need BOTH for completion
        return (has_success and has_confirmation), ...
```

---

## browser/browser_manager.py

### Browser Startup (Line ~50)
```python
async def start(self):
    """Start Chrome browser with persistent session.
    
    PERSISTENT CONTEXT means:
    - Cookies saved between runs
    - localStorage preserved
    - Login sessions persist
    - No need to re-login every time!
    
    The user_data_dir is like Chrome's profile folder.
    Delete it to start fresh (lose all logins).
    """
    self.playwright = await async_playwright().start()
    
    # Launch with persistent context (saves session data)
    self.context = await self.playwright.chromium.launch_persistent_context(
        user_data_dir=self.user_data_dir,  # Where to save profile
        headless=self.headless,  # Show browser window or not
        args=["--disable-blink-features=AutomationControlled"],  # Hide automation
    )
```

### Action Execution with Tab Detection (Line ~215)
```python
# === IMPORTANT: Detect new tabs BEFORE clicking ===
# Some links open in new tabs - we need to switch to them automatically
pages_before = len(self.context.pages)  # Count tabs before click

# Set up event listener for new tabs
# This fires immediately when new tab opens
def handle_popup(new_page):
    self.page = new_page  # Switch to new tab
    log(f"Switched to new tab: {new_page.url}")

self.context.on("page", handle_popup)

# Now click (might open new tab)
await self.page.click(selector)

# Wait briefly for new tab to appear
await asyncio.sleep(0.5)

# Remove listener (don't need it anymore)
self.context.remove_listener("page", handle_popup)

# Check if new tab opened
pages_after = len(self.context.pages)
if pages_after > pages_before:
    log("New tab detected and switched automatically!")
```

### Popup Dismissal Strategies (Line ~394)
```python
async def dismiss_overlays(self):
    """Close cookie banners, modals, popups before taking screenshot.
    
    WHY? Overlays block content and make screenshots confusing.
    
    6 STRATEGIES (tried in order):
    1. Cookie banners: Look for "Accept all", "I agree" buttons
    2. Escape key: Universal modal closer
    3. Close buttons: X, ✕, [aria-label="Close"]
    4. Notifications: Toast messages with "Dismiss"
    5. Backdrops: Click outside modal
    6. High z-index: Find overlays by CSS z-index property
    
    Returns True if anything was dismissed.
    """
    
    # Strategy 1: Cookie consent banners (most common)
    cookie_patterns = ["Accept all", "Accept", "I agree", "Continue"]
    for text in cookie_patterns:
        button = page.get_by_role("button", name=text)
        if await button.count() > 0:
            await button.click()
            return True
    
    # Strategy 2: Press Escape (works for many modals)
    await page.keyboard.press("Escape")
    
    # Strategy 3-6: Try various close button patterns...
```

---

## agent/vision_agent.py

### Screenshot Analysis (Line ~43)
```python
async def decide_next_action(self, screenshot_path, goal, observation, previous_actions):
    """Analyze screenshot and decide what to click/type next.
    
    HOW IT WORKS:
    1. Load screenshot as base64 image
    2. Send to GPT-4 Vision with prompt:
       - "What's on screen?"
       - "What should I do to accomplish goal?"
       - "Previous actions: [...]" (includes FAILED actions)
    3. GPT-4 returns JSON: {type: "click", target_text: "New Project", reason: "..."}
    4. We validate and return action
    
    IMPORTANT: previous_actions includes FAILED attempts
    This prevents AI from repeating the same failed click!
    
    Example:
    previous_actions = [
        "click:Projects",
        "FAILED: click 'Projects' (no effect)",  ← AI sees this!
        "click:New"
    ]
    
    AI learns: "Projects button didn't work, try something else"
    """
    
    # Load screenshot as base64 for GPT-4 Vision
    with open(screenshot_path, "rb") as f:
        base64_img = base64.b64encode(f.read()).decode()
    
    # Build prompt for AI
    prompt = f"""
    Goal: {goal}
    Current URL: {observation['url']}
    Previous actions: {previous_actions}
    
    CRITICAL: If you see "FAILED:" in previous actions, DON'T repeat them!
    Analyze screenshot and decide next action.
    """
    
    # Call GPT-4 Vision
    response = await self.client.chat.completions.create(
        model=self.model,
        messages=[
            {"role": "system", "content": "You are a UI automation expert"},
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": f"data:image/png;base64,{base64_img}"}
            ]}
        ]
    )
```

---

## agent/planner_agent.py

### Task Planning (Line ~45)
```python
async def plan_task(self, task, app_name, start_url):
    """Break task into step-by-step plan.
    
    EXAMPLE:
    Task: "Create a new project in Linear"
    
    Plan returned:
    [
      {step: 1, type: "navigate", description: "Go to Linear"},
      {step: 2, type: "login", description: "Log into Linear"},
      {step: 3, type: "screenshot", description: "Capture logged-in state"},
      {step: 4, type: "interact", description: "Click 'New Project' button"},
      {step: 5, type: "interact", description: "Fill project name field"},
      {step: 6, type: "interact", description: "Click 'Create' button"},
      {step: 7, type: "verify", description: "Check project was created"}
    ]
    
    STEP TYPES:
    - navigate: Go to URL
    - login: Authenticate
    - screenshot: Capture state (no action)
    - interact: Click/type something
    - verify: Check if task complete
    
    NOTE: This is just initial plan. Actual execution might differ
    because Vision AI decides actions dynamically based on what it sees.
    """
    
    prompt = f"""
    Create a step-by-step plan for this task: {task}
    
    Web app: {app_name}
    URL: {start_url}
    
    Return JSON with steps array.
    Each step needs: step_number, type, name, description
    """
    
    response = await self.client.chat.completions.create(
        model=self.model,
        messages=[{"role": "user", "content": prompt}]
    )
```

---

## browser/auth_manager.py

### Provider Detection (Line ~60)
```python
async def ensure_logged_in(self, page, login_url):
    """Log into web app if not already logged in.
    
    FLOW:
    1. Check if already logged in (look for logout button)
    2. If not, detect auth provider by URL
    3. Execute provider-specific login flow
    
    WHY PROVIDER-SPECIFIC?
    Different apps use different auth systems:
    - Atlassian: Custom identity system with OAuth
    - Linear: OAuth with email magic link
    - Google: OAuth with multiple redirect pages
    - Generic: Simple username/password forms
    
    Each needs different element selectors and wait conditions.
    
    DETECTION LOGIC:
    if "atlassian.com" in url → Atlassian Identity
    elif "linear.app" in url → Linear OAuth
    elif "google.com" in url → Google OAuth
    else → Generic username/password
    """
    
    # Check if already logged in
    logout_indicators = ["Log out", "Sign out", "user-menu"]
    for indicator in logout_indicators:
        if await page.locator(f"text={indicator}").count() > 0:
            log("Already logged in!")
            return
    
    # Detect provider by URL
    if "atlassian.com" in page.url:
        await self._handle_atlassian_login(page)
    elif "linear.app" in page.url:
        await self._handle_linear_oauth(page)
    # ... etc
```

### Atlassian Login Example (Line ~120)
```python
async def _handle_atlassian_login(self, page):
    """Handle Atlassian Identity login (used by Jira, Confluence).
    
    ATLASSIAN FLOW:
    1. Enter email on first page
    2. Click "Continue"
    3. Wait for password page (different page!)
    4. Enter password
    5. Click "Log in"
    6. Wait for dashboard URL
    
    TRICKY PARTS:
    - Two separate pages (email, then password)
    - Multiple redirects during OAuth
    - Need to wait for specific URL patterns
    """
    
    # Page 1: Email
    await page.fill("input[name='username']", self.email)
    await page.click("button[type='submit']")
    
    # Wait for password page
    await page.wait_for_url("**/login", timeout=10000)
    
    # Page 2: Password
    await page.fill("input[name='password']", self.password)
    await page.click("button[type='submit']")
    
    # Wait for dashboard (login complete)
    await page.wait_for_url("**/dashboard", timeout=15000)
```

---

## utils/screenshot_analyzer.py

### Report Generation (Line ~280)
```python
async def generate_narrative(self, dataset, task, run_dir):
    """Generate HTML report from screenshots and action data.
    
    PROCESS:
    1. Load all screenshots from run_dir
    2. Deduplicate (remove near-identical images)
    3. For each transition (step N → step N+1):
       - Get action that was taken
       - Generate explanation using GPT-4
       - Add to HTML with before/after screenshots
    4. Create HTML file with styled report
    5. Also create Markdown version
    
    OUTPUT FILES:
    - execution_report.html (open in browser)
    - execution_report.md (text version)
    
    DEDUPLICATION:
    Uses perceptual hashing (pHash) to find similar images.
    Threshold: 20 bits (configurable)
    - 0-5 bits: Identical
    - 6-15 bits: Very similar
    - 16-25 bits: Similar (our threshold)
    - 26+ bits: Different
    """
    
    # Step 1: Find all screenshots
    screenshots = list(run_dir.glob("step_*.png"))
    
    # Step 2: Remove duplicates
    unique_screenshots = self.deduplicate_screenshots(screenshots)
    
    # Step 3: Generate transition explanations
    for i in range(len(unique_screenshots) - 1):
        before = unique_screenshots[i]
        after = unique_screenshots[i + 1]
        action = dataset[i]['action']
        
        # Use GPT-4 to explain what happened
        explanation = await self._generate_transition_explanation(
            before, after, action
        )
```

### Deduplication Logic (Line ~32)
```python
def deduplicate_screenshots(self, screenshots):
    """Remove duplicate/similar screenshots using perceptual hashing.
    
    HOW IT WORKS:
    1. For each screenshot, compute pHash (perceptual hash)
    2. Compare hash to all previously seen hashes
    3. If difference <= threshold: duplicate (skip it)
    4. If difference > threshold: unique (keep it)
    
    PERCEPTUAL HASH:
    Unlike MD5 (exact match only), pHash finds visually similar images.
    Even if pixels slightly different (compression, anti-aliasing),
    pHash will match.
    
    Example:
    - Screenshot A: pHash = 0x1234567890ABCDEF
    - Screenshot B: pHash = 0x1234567890ABCDEE (1 bit different)
    - Hamming distance = 1 bit
    - Since 1 < 20 (threshold), B is duplicate of A
    """
    
    unique = []
    seen_hashes = []
    
    for screenshot in screenshots:
        img = Image.open(screenshot)
        img_hash = imagehash.phash(img)
        
        # Check if similar to any seen image
        is_duplicate = False
        for seen_hash in seen_hashes:
            # Hamming distance = number of differing bits
            difference = abs(img_hash - seen_hash)
            
            if difference <= self.threshold:  # Default: 20 bits
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique.append(screenshot)
            seen_hashes.append(img_hash)
    
    return unique
```

---

## config.py

### Configuration Structure
```python
# === DIRECTORIES ===
# Where screenshots and reports are saved
SCREENSHOT_DIR = "./captured_dataset"

# Where Chrome profile is saved (cookies, localStorage, etc.)
# Delete this folder to start fresh with no saved logins
USER_DATA_DIR = "./browser_session_data"

# === CREDENTIALS ===
# Load from .env file
LOGIN_EMAIL = os.getenv("LOGIN_EMAIL")
LOGIN_PASSWORD = os.getenv("LOGIN_PASSWORD")

# === OPENAI ===
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Required!
LLM_MODEL = "gpt-4o"  # GPT-4 with vision capabilities

# === APP URL MAPPINGS ===
# Extensible dictionary: app_name → url
# Users can override via .env: APP_URL_MAPPINGS='{"myapp":"https://myapp.com"}'
DEFAULT_APP_URL_MAPPINGS = {
    "notion": "https://app.notion.so",
    "linear": "https://linear.app",
    "jira": "https://id.atlassian.com/login",
    # ... 20+ more apps
}

# Load custom mappings from .env (optional)
custom = os.getenv("APP_URL_MAPPINGS")
if custom:
    APP_URL_MAPPINGS = {**DEFAULT_APP_URL_MAPPINGS, **json.loads(custom)}
else:
    APP_URL_MAPPINGS = DEFAULT_APP_URL_MAPPINGS

# === SCREENSHOT SETTINGS ===
# Enable/disable deduplication
SCREENSHOT_DEDUPLICATION_ENABLED = True

# Threshold for considering images duplicates (in bits)
# Lower = stricter, Higher = more lenient
SCREENSHOT_DEDUPLICATION_THRESHOLD = 20

# Whether to delete duplicate files from disk
# False = keep all screenshots for inspection
SCREENSHOT_DELETE_DUPLICATES = False
```

---

## Key Debugging Points

### When System Gets Stuck

**Look for in logs:**
```
LOOP: LOOP DETECTED: Clicking same element repeatedly with no effect (3 times)
LOOP: Recent actions: ['click:Projects', 'click:Projects', 'click:Projects']
```

**What's happening:**
- `action_history` shows repeated actions
- `_detect_loop()` detected pattern
- System asks AI if stuck or making progress

**How to fix:**
1. Check Vision AI prompt (maybe not clear enough)
2. Adjust loop detection threshold
3. Improve action validation

---

### When Login Fails

**Look for in logs:**
```
Attempting to fill email field: input[name='email']
Error: Timeout waiting for selector
```

**What's happening:**
- `auth_manager` trying to find login fields
- Selector doesn't match actual page elements
- Timeout after 10 seconds

**How to fix:**
1. Open browser (run without --headless)
2. Inspect actual login form elements
3. Update selector in `auth_manager.py`
4. Or log in manually first time (session persists)

---

### When Screenshots Are All Same

**Look for in logs:**
```
✗ DUPLICATE: step_5.png (diff: 3 bits)
✗ DUPLICATE: step_6.png (diff: 2 bits)
```

**What's happening:**
- `deduplicate_screenshots()` finding similar images
- Threshold too strict (20 bits)
- Maybe page isn't changing

**How to fix:**
1. Check if actions actually working (look for "page didn't change" warnings)
2. Increase `SCREENSHOT_DEDUPLICATION_THRESHOLD` in config
3. Set `SCREENSHOT_DEDUPLICATION_ENABLED = False` temporarily

---

**End of Inline Comments Guide**
