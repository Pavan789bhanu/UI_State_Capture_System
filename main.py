"""Command line entrypoint for the UI capture agent.

=== WHAT THIS SYSTEM DOES ===
This is an AI-powered browser automation system that:
1. Takes a task in plain English (e.g., "Create a new project in task management system")
2. Opens a web browser and navigates to the app
3. Uses AI (GPT-4 Vision) to understand what's on screen
4. Figures out what buttons to click and forms to fill
5. Takes screenshots at each step
6. Generates a detailed report showing how the task was done

=== HOW TO USE IT ===
Basic usage (interactive):
    python main.py
    (You'll be prompted to describe your task)

With task specified:
    python main.py --task "How do I filter issues in project tracker?"
    python main.py --task "Create a document" --start-url "https://example.com"

With credentials:
    python main.py --task "Create project" --login-email "you@company.com"

=== AUTHENTICATION ===
The system can log you in automatically if you provide credentials:
- Set LOGIN_EMAIL and LOGIN_PASSWORD in your .env file, OR
- Use --login-email and --login-password flags

The first time you use an app, you might need to log in manually.
Your session is saved in browser_session_data/ for future runs.

=== OUTPUT ===
Everything is saved to: ./captured_dataset/run_TIMESTAMP/
- Screenshots: step_1.png, step_2.png, etc.
- Report: execution_report.html (open in browser to see the workflow)
- Raw data: plan_execution_manifest.json (for programmatic access)

=== EXAMPLE TASKS ===
- "How do I create a new project in project management tool?"
- "Filter database by status in note-taking app"
- "Create a new issue in issue tracker"
- "Add a task to Asana"
"""

from __future__ import annotations

import argparse
import asyncio
import os
import getpass

# === IMPORT OUR COMPONENTS ===
# These are the building blocks of the system:
from utils.input_parser import extract_app_and_url, normalize_url, generate_url_from_app_name  # Parse user input
from browser.browser_manager import BrowserManager  # Controls Chrome/browser via Playwright
from browser.auth_manager import AuthManager  # Handles login flows (username/password, OAuth)
from agent.vision_agent import VisionAgent  # AI that "sees" screenshots and decides what to click
from workflow.workflow_engine import WorkflowEngine  # Orchestrates everything: planning, execution, reporting
from utils.logger import log  # Simple console logging


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.
    
    This function defines what flags users can pass when running the script.
    All arguments are optional - if not provided, the system will prompt
    the user interactively or use smart defaults.
    """
    parser = argparse.ArgumentParser(description="Run the UI capture agent")
    parser.add_argument("--start-url", help="URL to begin the workflow")
    parser.add_argument("--goal", help="High level description of the task")
    parser.add_argument("--task", help="Single-line natural language task (optional)")
    parser.add_argument("--login-url", help="Login URL to trigger authentication (optional)")
    parser.add_argument("--login-email", help="Email address to use for login (optional)")
    parser.add_argument("--login-password", help="Password to use for login (optional; will prompt if email provided but password omitted)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    
    # Step 1: Get task from user
    task_input = args.task
    if not task_input:
        try:
            task_input = input("Please describe the task (e.g., 'How do I filter a database in MyApp?'): ")
        except EOFError:
            raise SystemExit("No task provided and no interactive input available.")
    
    if not task_input.strip():
        raise SystemExit("Task cannot be empty.")

    log(f"Task received: {task_input}")

    # Step 2: Extract app name and URL from task
    app_name, parsed_url = extract_app_and_url(task_input)
    
    if not app_name:
        raise SystemExit("Could not extract app name from task. Please mention the app name (e.g., 'in MyApp', 'on TaskManager').")

    log(f"Extracted app name: {app_name}")

    # Step 3: Generate URL if not found in task
    if not parsed_url:
        generated_url = generate_url_from_app_name(app_name)
        start_url = generated_url
        log(f"Generated URL for '{app_name}': {generated_url}")
    else:
        start_url = parsed_url

    # Ensure start_url is normalized
    start_url = normalize_url(start_url)

    # Step 4: Load credentials from environment or config
    login_email = args.login_email or os.getenv("LOGIN_EMAIL")
    login_password = args.login_password or os.getenv("LOGIN_PASSWORD")
    
    # If we have email but no password, prompt for it
    if login_email and not login_password:
        try:
            login_password = getpass.getpass(prompt=f"Password for {login_email}: ")
        except Exception:
            login_password = None
            log("Warning: Could not read password interactively.")

    if not login_email or not login_password:
        log("Warning: No login credentials provided. Some apps may require authentication.")
    else:
        log("Credentials loaded from configuration.")

    # Step 5: Initialize components
    browser = BrowserManager(headless=args.headless)
    auth = AuthManager(email=login_email, password=login_password)
    
    from agent.planner_agent import PlannerAgent
    planner = PlannerAgent()
    
    vision = VisionAgent()
    engine = WorkflowEngine(
        browser=browser,
        vision_agent=vision,
        planner_agent=planner,
        auth=auth,
    )

    # Step 6: Execute the task using planner
    log(f"Starting workflow for task: {task_input}")
    log(f"App: {app_name}, URL: {start_url}")

    await engine.run_task(
        task=task_input,
        app_name=app_name,
        start_url=start_url,
        login_url=args.login_url,
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("Interrupted by user; shutting down.")