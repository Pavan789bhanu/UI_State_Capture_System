"""Workflow orchestration for UI state capture.

`WorkflowEngine` coordinates between the browser manager, the vision
agent and the authentication helper. It implements a loop where the
current UI state is captured, summarised, sent to the LLM for a
decision, executed in the browser and optionally saved to the dataset.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from pathlib import Path
from typing import List, Optional

from playwright.async_api import Page

from app.automation.browser.browser_manager import BrowserManager
from app.automation.browser.auth_manager import AuthManager
from app.automation.agent.vision_agent import VisionAgent
from app.automation.agent.planner_agent import PlannerAgent
from app.automation.utils.file_utils import save_json
from app.automation.utils.logger import log
from app.automation.utils.dom_parser import parse_dom
from app.automation.utils.screenshot_analyzer import ScreenshotAnalyzer
from app.automation.utils.url_validator import URLValidator
from app.automation.utils.input_parser import extract_form_data
from app.services.content_generator import ContentGenerator
from app.automation.workflow.task_verifier import GenericTaskVerifier
from app.services.workflow_learner import WorkflowLearner
from app.automation.workflow.loop_detector import LoopDetector
from app.automation.workflow.completion_checker import CompletionChecker
from app.core.config import settings


class WorkflowEngine:
    """Coordinate the UI capture workflow."""

    def __init__(
        self,
        browser: Optional[BrowserManager] = None,
        vision_agent: Optional[VisionAgent] = None,
        planner_agent: Optional[PlannerAgent] = None,
        auth: Optional[AuthManager] = None,
    ) -> None:
        self.browser = browser or BrowserManager(headless=True)
        self.vision_agent = vision_agent or VisionAgent()
        self.planner_agent = planner_agent or PlannerAgent()
        self.auth = auth
        self.dataset: List[dict] = []
        self.url_validator = URLValidator()  # Initialize URL validator
        self.report_path: Optional[str] = None  # Store the report path
        self.content_generator = ContentGenerator()  # Initialize content generator
        self.workflow_learner = WorkflowLearner()  # Initialize learning system
        self.loop_detector = LoopDetector(window_size=settings.LOOP_DETECTION_WINDOW)
        self.completion_checker = CompletionChecker()

    async def _evaluate_completion(self, page: Page, task: str, app_name: str) -> tuple[bool, bool, List[str]]:
        """Evaluate completion using CompletionChecker.

        Returns:
            (completed, partial_progress, reasons)
        """
        return await self.completion_checker.evaluate_completion(page, task, app_name)



    def _detect_loop(self, action_history: List[dict]) -> tuple[bool, str]:
        """Detect if we're in a repetitive loop using LoopDetector.
        
        Returns (is_loop, reason)
        """
        return self.loop_detector.detect_loop(action_history)



    async def run_task(
        self,
        task: str,
        app_name: str,
        start_url: str,
        login_url: Optional[str] = None,
    ) -> None:
        """Run the UI capture process for a given task using the planner.

        Args:
            task: User's natural language task.
            app_name: Name of the web app (e.g., "TaskManager").
            start_url: URL of the app.
            login_url: Optional login URL.
        """
        # Unique identifier for this run
        run_id = f"run_{int(time.time())}"
        
        # Start tracking execution for learning
        execution_id = self.workflow_learner.start_execution(task, app_name, start_url)
        log(f"Started learning-tracked execution: {execution_id}")
        
        # Task completion tracking
        start_time = time.time()
        last_action_time = time.time()
        # Use configured adaptive parameters
        max_inactivity_seconds = settings.MAX_INACTIVITY_SECONDS
        max_extra_cycles = settings.MAX_ADAPTIVE_CYCLES

        task_completed = False
        total_errors = 0
        max_consecutive_errors = 3
        
        # Track visited screens to detect when we're looping
        visited_screen_states = []  # List of (url, dom_hash) tuples
        same_screen_count = 0
        max_same_screen_attempts = 4  # Auto-backtrack after 4 attempts on same screen

        await self.browser.start()
        page: Page = self.browser.page  # type: ignore

        # Validate and get best URL for this app (cached if available)
        validated_url = self.url_validator.get_validated_url(app_name, start_url)
        if validated_url != start_url:
            log(f"Using validated URL instead of proposed: {validated_url}")
            start_url = validated_url

        # Get the plan from planner agent
        log(f"Planning task: {task}")
        plan = await self.planner_agent.plan_task(task, app_name, start_url)
        total_steps = plan.get('total_steps', 0)
        log(f"Plan created with {total_steps} steps")
        
        # Extract form data from task description
        form_data = extract_form_data(task)
        if form_data:
            log(f"Extracted form data from task: {form_data}")
            
            # If this is a document creation task with content topic, generate content
            if "content_topic" in form_data:
                topic = form_data["content_topic"]
                keywords = form_data.get("content_keywords", [])
                log(f"Detected document creation task about: {topic}")
                
                # Generate content based on topic
                generated = self.content_generator.generate_content(topic, keywords)
                
                # Add generated content to form_data
                if "title" not in form_data and "name" not in form_data:
                    form_data["title"] = generated["title"]
                    form_data["name"] = generated["title"]  # Backup field name
                    log(f"Generated title: {generated['title']}")
                
                form_data["content"] = generated["content"]
                log(f"Generated content ({len(generated['content'])} characters)")
        else:
            log("No specific form data found in task description")

        step_counter = 0
        consecutive_errors = 0
        action_history: List[dict] = []  # Full action history for loop detection
        loop_quit_checks = 0  # Track loop detection quit checks (max 2)
        
        for plan_step in plan.get("steps", []):
            step_counter += 1
            step_num = plan_step.get("step_number", step_counter)
            step_name = plan_step.get("name", "")
            step_type = plan_step.get("type", "")
            step_desc = plan_step.get("description", "")

            log(f"--- Plan Step {step_num}: {step_name} ({step_type}) ---")
            log(f"    Description: {step_desc}")
            
            # Check for inactivity timeout
            time_since_last_action = time.time() - last_action_time
            if time_since_last_action > max_inactivity_seconds:
                log(f"WARNING:  Inactivity timeout: {time_since_last_action:.1f}s elapsed without progress")
                log("Closing browser due to inactivity")
                break

            try:
                # Update last action time on successful step
                last_action_time = time.time()
                consecutive_errors = 0  # Reset error counter on success
                # Note: consecutive_failures is reset per-action, not per-step
                
                if step_type == "navigate":
                    # URL validation and retry logic
                    max_nav_retries = 2
                    nav_success = False
                    
                    for attempt in range(max_nav_retries):
                        try:
                            log(f"Navigating to {start_url} (attempt {attempt + 1}/{max_nav_retries})")
                            response = await page.goto(start_url, wait_until="domcontentloaded", timeout=15000)
                            
                            # Validate navigation was successful
                            if response and response.ok:
                                log(f"✓ Successfully loaded {start_url} (status: {response.status})")
                                # Cache this validated URL for future runs
                                self.url_validator.cache_validated_url(app_name, start_url, response.status)
                                nav_success = True
                                # Wait 5 seconds for webapp to fully load (JS, dynamic content, etc.)
                                log("Waiting 5 seconds for webapp to fully load...")
                                await asyncio.sleep(5)
                                
                                # Check if authentication is needed and handle it
                                log("Checking if sign-in is required...")
                                await self._check_and_handle_signin(page, login_url)
                                
                                break
                            elif response:
                                log(f"⚠ Navigation returned status {response.status} for {start_url}")
                                if attempt < max_nav_retries - 1:
                                    log("Retrying with alternate approach...")
                                    await asyncio.sleep(2)
                            else:
                                log(f"⚠ No response received from {start_url}")
                                
                        except Exception as nav_error:
                            error_msg = str(nav_error)[:150]
                            log(f"✗ Navigation error (attempt {attempt + 1}): {error_msg}")
                            
                            if attempt < max_nav_retries - 1:
                                # Try to recover the session
                                try:
                                    log("Attempting to recover browser session...")
                                    if page.is_closed():
                                        log("Page was closed, creating new page")
                                        page = await self.browser.context.new_page()
                                        self.browser.page = page
                                    await asyncio.sleep(2)
                                except Exception as recovery_error:
                                    log(f"Recovery failed: {str(recovery_error)[:100]}")
                    
                    if not nav_success:
                        log(f"⚠ WARNING: Could not load {start_url} after {max_nav_retries} attempts")
                        log(f"⚠ Verify the URL is correct for {app_name}")
                        log("Continuing with current page state...")

                elif step_type == "login":
                    if self.auth and self.auth.email and self.auth.password:
                        log("Attempting login with provided credentials")
                        await self.auth.ensure_logged_in(page, login_url)
                    else:
                        log("No credentials available for login step.")

                elif step_type == "screenshot":
                    try:
                        screenshot_path = await self.browser.capture_screen(run_id, step_counter)
                        log(f"Screenshot saved: {screenshot_path}")
                        self.dataset.append({
                            "task": task,
                            "step": step_counter,
                            "plan_step": step_num,
                            "type": "screenshot",
                            "ui_state_description": step_desc,
                            "screenshot_path": screenshot_path,
                            "url": page.url,
                        })
                    except Exception as screenshot_error:
                        log(f"Screenshot failed but continuing: {str(screenshot_error)[:80]}")
                        # Continue execution even if screenshot fails

                elif step_type == "interact":
                    # Check if page/context is still valid
                    if page.is_closed():
                        log("WARNING:  Page closed unexpectedly; attempting to recover...")
                        if self.browser.context and not self.browser.context.pages:
                            log("Context has no pages; creating new page")
                            page = await self.browser.context.new_page()
                            self.browser.page = page
                        elif self.browser.context and self.browser.context.pages:
                            page = self.browser.context.pages[0]
                            self.browser.page = page
                            log("Recovered to first available page")
                        else:
                            log("Cannot recover; skipping step")
                            continue
                    
                    # CRITICAL: Check for blank/minimal screen before proceeding
                    try:
                        visible_text = await page.evaluate("""
                            () => {
                                const body = document.body;
                                return body ? body.innerText.trim() : '';
                            }
                        """)
                        
                        if len(visible_text) < 50:
                            log("WARNING: Blank or minimal screen detected!")
                            log("Taking screenshot to analyze empty state...")
                            
                            # Try going back
                            if len(action_history) > 0:
                                log("Attempting to go back to previous page...")
                                try:
                                    await page.go_back(wait_until="domcontentloaded", timeout=3000)
                                    await asyncio.sleep(1)
                                    
                                    # Re-check if we have content now
                                    visible_text_after = await page.evaluate("""
                                        () => document.body ? document.body.innerText.trim() : '';
                                    """)
                                    
                                    if len(visible_text_after) > 50:
                                        log("SUCCESS: Recovered by going back, page has content now")
                                    else:
                                        log("WARNING: Still blank after going back")
                                except Exception as back_err:
                                    log(f"Go back failed: {back_err}")
                    except Exception as blank_check_err:
                        log(f"Blank check error: {blank_check_err}")
                    
                    # Use vision agent to decide action based on current page
                    screenshot_path = await self.browser.capture_screen(run_id, step_counter)
                    dom_html = await page.content()
                    
                    # CRITICAL: Auto-detect and handle login pages
                    current_url = page.url.lower()
                    
                    # Handle Google OAuth login
                    if "accounts.google.com" in current_url and ("signin" in current_url or "identifier" in current_url):
                        log("Detected Google OAuth login page - auto-filling credentials...")
                        try:
                            # Fill email
                            email_selectors = [
                                "input[type='email']",
                                "input[name='identifier']", 
                                "#identifierId",
                            ]
                            
                            email_filled = False
                            for sel in email_selectors:
                                try:
                                    email_input = page.locator(sel)
                                    if await email_input.count() > 0:
                                        await email_input.first.fill(self.auth.email)
                                        log(f"✓ Filled Google OAuth email: {self.auth.email}")
                                        await asyncio.sleep(1)
                                        
                                        # Click Next button
                                        next_btns = [
                                            "button:has-text('Next')",
                                            "button[type='submit']",
                                            "#identifierNext"
                                        ]
                                        for btn_sel in next_btns:
                                            try:
                                                next_btn = page.locator(btn_sel).first
                                                if await next_btn.count() > 0:
                                                    await next_btn.click()
                                                    log("✓ Clicked Next button")
                                                    await asyncio.sleep(3)
                                                    break
                                            except Exception:
                                                pass
                                        email_filled = True
                                        await asyncio.sleep(0.5)
                                        
                                        # Click Next button
                                        next_btn = page.get_by_role("button", name="Next")
                                        if await next_btn.count() > 0:
                                            await next_btn.first.click()
                                            log("✓ Clicked 'Next' button")
                                            await asyncio.sleep(2)
                                        break
                                except Exception:
                                    continue
                            
                            if not email_filled:
                                log("Could not find Google email input - continuing with Vision Agent")
                            else:
                                # Check if password page loaded
                                password_selectors = ["input[type='password']", "input[name='password']"]
                                for sel in password_selectors:
                                    try:
                                        pwd_input = page.locator(sel)
                                        if await pwd_input.count() > 0:
                                            await pwd_input.first.fill(self.auth.password)
                                            log(f"✓ Filled Google OAuth password")
                                            await asyncio.sleep(1)
                                            
                                            # Click Sign in / Next button
                                            signin_btns = [
                                                "button:has-text('Next')",
                                                "button:has-text('Sign in')",
                                                "button[type='submit']",
                                                "#passwordNext"
                                            ]
                                            for btn_sel in signin_btns:
                                                try:
                                                    signin_btn = page.locator(btn_sel).first
                                                    if await signin_btn.count() > 0:
                                                        await signin_btn.click()
                                                        log("✓ Clicked Sign in button")
                                                        await asyncio.sleep(5)
                                                        break
                                                except Exception:
                                                    pass
                                            await asyncio.sleep(0.5)
                                            
                                            # Click Next/Sign in
                                            submit_btn = page.get_by_role("button", name=re.compile(r"Next|Sign in", re.I))
                                            if await submit_btn.count() > 0:
                                                await submit_btn.first.click()
                                                log("✓ Clicked 'Next/Sign in' button")
                                                await asyncio.sleep(3)
                                            break
                                    except Exception:
                                        continue
                        except Exception as oauth_err:
                            log(f"Google OAuth auto-fill error: {oauth_err}")
                    
                    # Handle generic email/password login pages (Notion, etc.)
                    elif ("login" in current_url or "signin" in current_url or "sign-in" in current_url):
                        log("Detected login page - checking for email/password fields...")
                        try:
                            # Look for email input
                            email_selectors = [
                                "input[type='email']",
                                "input[name='email']",
                                "input[id*='email']",
                                "input[placeholder*='email' i]",
                                "input[placeholder*='Email' i]",
                                "input[aria-label*='email' i]",
                            ]
                            
                            email_found = False
                            password_found = False
                            
                            for sel in email_selectors:
                                try:
                                    email_input = page.locator(sel)
                                    if await email_input.count() > 0 and await email_input.first.is_visible():
                                        await email_input.first.fill(self.auth.email)
                                        log(f"✓ Auto-filled email: {self.auth.email}")
                                        email_found = True
                                        await asyncio.sleep(0.5)
                                        break
                                except Exception:
                                    continue
                            
                            # Look for password input
                            password_selectors = [
                                "input[type='password']",
                                "input[name='password']",
                                "input[id*='password']",
                                "input[placeholder*='password' i]",
                            ]
                            
                            for sel in password_selectors:
                                try:
                                    pwd_input = page.locator(sel)
                                    if await pwd_input.count() > 0 and await pwd_input.first.is_visible():
                                        await pwd_input.first.fill(self.auth.password)
                                        log(f"✓ Auto-filled password")
                                        password_found = True
                                        await asyncio.sleep(0.5)
                                        break
                                except Exception:
                                    continue
                            
                            # If both fields filled, try to submit
                            if email_found and password_found:
                                log("Both credentials filled - attempting to submit...")
                                try:
                                    # Handle reCAPTCHA if present
                                    recaptcha_frames = [f for f in page.frames if "recaptcha" in f.url.lower()]
                                    if recaptcha_frames:
                                        log("Checking for reCAPTCHA checkbox...")
                                        for frame in recaptcha_frames:
                                            try:
                                                checkbox = frame.locator(".recaptcha-checkbox-border, #recaptcha-anchor")
                                                if await checkbox.count() > 0:
                                                    await checkbox.first.click()
                                                    log("✓ Clicked reCAPTCHA checkbox")
                                                    await asyncio.sleep(2)
                                                    break
                                            except Exception:
                                                continue
                                    
                                    # Look for submit button
                                    submit_patterns = [
                                        "button:has-text('Sign in')",
                                        "button:has-text('Log in')",
                                        "button:has-text('Login')",
                                        "button:has-text('Continue')",
                                        "button[type='submit']",
                                        "input[type='submit']",
                                    ]
                                    
                                    submitted = False
                                    for pattern in submit_patterns:
                                        try:
                                            btn = page.locator(pattern)
                                            if await btn.count() > 0:
                                                await btn.first.click()
                                                log(f"✓ Clicked submit button: {pattern}")
                                                await asyncio.sleep(3)
                                                submitted = True
                                                break
                                        except Exception:
                                            continue
                                    
                                    if not submitted:
                                        # Try pressing Enter on password field
                                        log("No submit button found - pressing Enter")
                                        await page.keyboard.press("Enter")
                                        await asyncio.sleep(3)
                                        
                                except Exception as submit_err:
                                    log(f"Submit error: {submit_err}")
                            elif email_found:
                                log("Only email field found - may need to continue to password page")
                            
                        except Exception as login_err:
                            log(f"Generic login auto-fill error: {login_err}")
                    
                    elements_summary = parse_dom(dom_html)
                    observation = {
                        "url": page.url,
                        "elements": elements_summary,
                    }

                    # Vision agent decision (this may take time, so update timestamp before)
                    log("Querying vision agent for next action (may take 10-30 seconds)...")
                    last_action_time = time.time()  # Reset timer before LLM call
                    
                    # CRITICAL: Include context about failed actions to prevent repetition
                    failed_actions = [a for a in action_history[-4:] if not a.get('executed', False) or not a.get('page_changed', False)]
                    # Build context from action history
                    context_msg = [f"{a.get('type')}:{a.get('target_text','')[:30]}" for a in action_history[-6:]]
                    
                    # Add backtrack context - show which pages we've visited
                    url_history = []
                    for a in action_history[-8:]:
                        url = a.get('url', '')
                        if url and url not in url_history:
                            url_history.append(url)
                    
                    if len(url_history) > 1:
                        context_msg.append(f"PAGE_HISTORY: {' -> '.join([u.split('/')[-1] or u.split('/')[-2] for u in url_history[-3:]])}")
                    
                    if failed_actions:
                        failed_summary = [f"FAILED: {a.get('type')} '{a.get('target_text','')}' (no effect)" for a in failed_actions]
                        context_msg.extend(failed_summary)
                        log(f"WARNING: Passing {len(failed_actions)} failed actions to Vision Agent for awareness")
                    
                    # Get learned guidance for this context
                    learned_guidance = self.workflow_learner.get_contextual_guidance(
                        goal=step_desc,
                        current_url=page.url,
                        previous_actions=context_msg
                    )
                    
                    action = await self.vision_agent.decide_next_action(
                        screenshot_path=screenshot_path,
                        goal=step_desc,
                        observation=observation,
                        previous_actions=context_msg,
                        form_data=form_data,
                        learned_guidance=learned_guidance,  # Pass learned patterns
                    )

                    log(f"LLM proposed action: {action}")
                    log(f"PLAN STEP: {step_desc}")
                    
                    # Extract action details
                    action_type = action.get("type")
                    selector = action.get("selector")
                    value = action.get("value")
                    target_text = action.get("target_text", "")
                    
                    log(f"ACTION TO EXECUTE: {action_type} - Target: '{target_text}' - Selector: {selector}")
                    
                    # CRITICAL: Handle "done" action - LLM thinks task is complete
                    if action_type == "done":
                        log(f"✓ LLM indicates task is COMPLETE")
                        log(f"   Reason: {action.get('reason', 'No reason provided')}")
                        if step_counter < total_steps:
                            log(f"   Note: Plan had {total_steps - step_counter} steps remaining, but LLM sees completion")
                        task_completed = True
                        # Record this as a successful completion
                        self.dataset.append({
                            "task": task,
                            "step": step_counter,
                            "plan_step": step_num,
                            "type": "completion",
                            "description": f"LLM detected task completion: {action.get('reason')}",
                            "screenshot_path": screenshot_path,
                            "url": page.url,
                            "action": action,
                        })
                        break  # Exit the step loop - task is done!
                    
                    # CRITICAL: Handle "back" action - LLM wants to backtrack
                    if action_type == "back":
                        log(f"⬅️  LLM suggests BACKTRACKING")
                        log(f"   Reason: {action.get('reason', 'Stuck or wrong path')}")
                        log(f"   Current URL: {page.url}")
                        
                        # Go back to previous page
                        try:
                            await page.go_back(wait_until="networkidle", timeout=5000)
                            await asyncio.sleep(2)
                            log(f"   ✓ Navigated back to: {page.url}")
                            
                            # Record the backtrack action
                            action_history.append({
                                "type": "back",
                                "target_text": "browser back",
                                "selector": None,
                                "url": page.url,
                                "url_before": url_before,
                                "url_after": page.url,
                                "executed": True,
                                "page_changed": True,
                            })
                            
                            self.dataset.append({
                                "task": task,
                                "step": step_counter,
                                "plan_step": step_num,
                                "type": "backtrack",
                                "description": f"Backtracked to try alternative path: {action.get('reason')}",
                                "screenshot_path": screenshot_path,
                                "url": page.url,
                                "action": action,
                            })
                            
                            last_action_time = time.time()
                            # Continue to next iteration to try different approach
                            continue
                        except Exception as back_err:
                            log(f"   ⚠️ Backtrack failed: {back_err}")
                            log(f"   Will try to proceed forward instead")
                    
                    # Execute the action, with better error handling

                    # CRITICAL: Capture state BEFORE action to validate success
                    url_before = page.url
                    dom_before_hash = hash(await page.content())
                    
                    # Check if we've been on this exact screen state before
                    current_screen_state = (url_before, dom_before_hash)
                    if current_screen_state in visited_screen_states[-3:]:  # Check last 3 states
                        same_screen_count += 1
                        log(f"⚠️  Same screen detected ({same_screen_count}/{max_same_screen_attempts})")
                        
                        if same_screen_count >= max_same_screen_attempts:
                            log(f"⚠️  STUCK on same screen for {same_screen_count} attempts - AUTO-BACKTRACKING")
                            try:
                                await page.go_back(wait_until="networkidle", timeout=5000)
                                await asyncio.sleep(2)
                                log(f"✓ Auto-backtracked to: {page.url}")
                                
                                action_history.append({
                                    "type": "back",
                                    "target_text": "auto-stuck-recovery",
                                    "selector": None,
                                    "url": page.url,
                                    "url_before": url_before,
                                    "url_after": page.url,
                                    "executed": True,
                                    "page_changed": True,
                                })
                                
                                same_screen_count = 0  # Reset counter
                                visited_screen_states = []  # Clear history to start fresh
                                last_action_time = time.time()
                                continue
                            except Exception as back_err:
                                log(f"⚠️  Auto-backtrack failed: {back_err}")
                    else:
                        same_screen_count = 0  # Reset if screen changed
                    
                    visited_screen_states.append(current_screen_state)
                    if len(visited_screen_states) > 10:  # Keep only recent states
                        visited_screen_states.pop(0)
                    
                    action_executed = False
                    
                    # Check if we've been stuck on same URL clicking same element
                    recent_clicks = [a for a in action_history[-3:] if a.get('type') == 'click']
                    if len(recent_clicks) >= 2:
                        same_target = all(a.get('target_text') == target_text for a in recent_clicks)
                        same_url = all(a.get('url') == url_before for a in recent_clicks)
                        no_url_change = all(not a.get('page_changed') for a in recent_clicks)
                        
                        if same_target and same_url and no_url_change:
                            log(f"WARNING: Stuck clicking '{target_text}' on {url_before} with no effect")
                            log("Trying alternative: backtrack or keyboard shortcut...")
                            
                            # Try backtracking if we've been stuck for 3+ actions
                            recent_failed = [a for a in action_history[-5:] if not a.get('page_changed', False)]
                            if len(recent_failed) >= 3:
                                log("BACKTRACK: Multiple failed actions detected, going back to previous page")
                                try:
                                    await page.go_back(wait_until="networkidle", timeout=5000)
                                    await asyncio.sleep(2)
                                    log(f"✓ Backtracked to: {page.url}")
                                    
                                    action_history.append({
                                        "type": "back",
                                        "target_text": "auto-backtrack",
                                        "selector": None,
                                        "url": page.url,
                                        "url_before": url_before,
                                        "url_after": page.url,
                                        "executed": True,
                                        "page_changed": True,
                                    })
                                    
                                    last_action_time = time.time()
                                    continue  # Skip to next iteration to try different approach
                                except Exception as back_err:
                                    log(f"Backtrack failed: {back_err}, trying keyboard shortcut...")
                            
                            # Try keyboard shortcut if it looks like template click
                            if any(word in target_text.lower() for word in ['blank', 'new', 'create']):
                                log("Attempting keyboard shortcut to create document...")
                                try:
                                    await page.keyboard.press('c')
                                    await asyncio.sleep(3)
                                    if page.url != url_before:
                                        log(f"✓ Keyboard shortcut worked! URL: {page.url}")
                                        action_executed = True
                                        last_action_time = time.time()
                                        # Skip normal action execution
                                        url_after = page.url
                                        page_changed = True
                                        
                                        # Record successful recovery
                                        self.workflow_learner.record_recovery(
                                            failure_action=action,
                                            recovery_action={'type': 'keyboard', 'target_text': 'c'},
                                            success=True
                                        )
                                        
                                        # Skip to recording
                                        self.workflow_learner.record_action(
                                            action={'type': 'keyboard', 'target_text': 'c'},
                                            success=True,
                                            url_before=url_before,
                                            url_after=page.url,
                                            observation="Keyboard shortcut recovery successful"
                                        )
                                        
                                        action_history.append({
                                            "type": "keyboard",
                                            "target_text": "c",
                                            "selector": None,
                                            "url": page.url,
                                            "url_before": url_before,
                                            "url_after": page.url,
                                            "executed": True,
                                            "page_changed": True,
                                        })
                                        
                                        # Continue to next iteration
                                        continue
                                except Exception as kb_err:
                                    log(f"Keyboard shortcut failed: {kb_err}")
                    
                    # Check for verification checkboxes before executing main action
                    # This handles Medium's "Verify you are human" and similar checkboxes
                    if step_counter > 0:  # Skip on first navigation
                        try:
                            await self.browser.handle_verification_checkbox(page)
                        except Exception as e:
                            # If it's a CAPTCHA detection, propagate the error to stop execution
                            if "CAPTCHA" in str(e) or "verify" in str(e).lower():
                                log(f"❌ CAPTCHA DETECTED - Stopping workflow execution")
                                raise e  # Re-raise to stop the workflow
                            else:
                                log(f"Verification checkbox check failed (non-critical): {e}")
                    
                    # Fix invalid selectors before attempting action
                    if selector and ":contains(" in selector:
                        log(f"Converting invalid selector: {selector}")
                        # Extract text from :contains('text') pattern
                        import re
                        match = re.search(r":contains\(['\"]([^'\"]+)['\"]\)", selector)
                        if match:
                            target_text = match.group(1)
                            selector = None  # Clear invalid selector to trigger fallback
                            log(f"Extracted target_text: {target_text}")
                    
                    try:
                        log(f"EXECUTING: {action_type} action...")
                        action_executed = await self.browser.execute_action(action_type=action_type, selector=selector, value=value)
                        log(f"ACTION RESULT: {'✓ Executed' if action_executed else '✗ Failed'}")
                        
                        # Fallback to smart_click if direct execution failed for clicks
                        if not action_executed and action_type == "click" and target_text:
                            log(f"Retrying click with smart_click_by_text('{target_text}')...")
                            action_executed = await self.browser.smart_click_by_text(target_text)
                            log(f"SMART_CLICK RESULT: {'✓ Executed' if action_executed else '✗ Failed'}")
                    except (ValueError, Exception) as ve:
                        log(f"⚠️ Action execution error: {ve}")
                        # Always try smart_click as fallback for click actions
                        if action_type == "click" and target_text:
                            log(f"Fallback: smart_click_by_text('{target_text}')...")
                            try:
                                action_executed = await self.browser.smart_click_by_text(target_text)
                                log(f"FALLBACK RESULT: {'✓ Executed' if action_executed else '✗ Failed'}")
                            except Exception as fallback_err:
                                log(f"⚠️ Fallback also failed: {fallback_err}")
                                action_executed = False
                    
                    # VALIDATION: Check if action actually changed the page state
                    url_after = page.url
                    dom_after_hash = hash(await page.content())
                    
                    page_changed = (url_after != url_before) or (dom_after_hash != dom_before_hash)
                    
                    log(f"PAGE STATE: URL: {url_before} → {url_after}")
                    log(f"PAGE STATE: DOM {'changed' if dom_after_hash != dom_before_hash else 'unchanged'}")
                    log(f"PAGE STATE: Overall: {'✓ CHANGED' if page_changed else '✗ NO CHANGE'}")
                    
                    if action_executed and not page_changed and action_type == "click":
                        log(f"⚠️ WARNING: Action executed but page didn't change!")
                        log(f"⚠️ Clicked '{target_text or selector}' but no visible effect detected")
                        # Mark as failed since it had no effect
                        action_executed = False
                    elif action_executed and page_changed:
                        log(f"✓ SUCCESS: Action had visible effect on page state")
                    elif action_executed and action_type == "type":
                        log(f"✓ Type action completed (page change not required)")
                        # Type actions don't always change page state immediately
                    
                    # Record action for learning system
                    self.workflow_learner.record_action(
                        action=action,
                        success=action_executed and page_changed,
                        url_before=url_before,
                        url_after=url_after,
                        observation=f"Executed: {action_executed}, Page changed: {page_changed}"
                    )
                    
                    # Record action in history for loop detection
                    action_history.append({
                        "type": action_type,
                        "target_text": target_text,
                        "selector": selector,
                        "url": page.url,
                        "url_before": url_before,
                        "url_after": url_after,
                        "executed": action_executed,
                        "page_changed": page_changed,
                    })
                    
                    # CRITICAL: Check for loops every 2 actions (starting from 4 actions)
                    # This catches loops earlier: 4, 6, 8, 10... instead of 6, 9, 12...
                    if len(action_history) >= 4 and len(action_history) % 2 == 0:
                        is_loop, loop_reason = self._detect_loop(action_history)
                        if is_loop and loop_quit_checks < 2:  # Limit quit checks to 2
                            loop_quit_checks += 1
                            log(f"LOOP: LOOP DETECTED: {loop_reason}")
                            recent_action_summary = [f"{a.get('type')}:{a.get('target_text','')}" for a in action_history[-4:]]
                            log(f"LOOP: Recent actions: {recent_action_summary}")
                            log("SCREENSHOT: Analyzing screenshot to determine if we should continue or quit...")
                            try:
                                quit_screenshot = await self.browser.capture_screen(run_id, step_counter + 0.7)
                                quit_observation = {"url": page.url, "elements": parse_dom(await page.content())}
                                # Build summary of recent actions for context
                                recent_summary = [f"{a.get('type')}:{a.get('target_text','')[:30]}" for a in action_history[-6:]]
                                quit_prompt = f"""LOOP DETECTED: {loop_reason}

Task: {task}
Recent actions: {recent_summary}

We're clicking the same element repeatedly with no effect. Analyze screenshot:
1. Type 'done' if we're stuck and should quit
2. Type 'continue' ONLY if you see a DIFFERENT element to try

Be honest - if truly stuck, quit gracefully."""
                                last_action_time = time.time()
                                action_context = [f"{a.get('type')}:{a.get('target_text','')[:30]}" for a in action_history[-8:]]
                                quit_decision = await self.vision_agent.decide_next_action(
                                    screenshot_path=quit_screenshot,
                                    goal=quit_prompt,
                                    observation=quit_observation,
                                    previous_actions=action_context,
                                    form_data=form_data,  # Pass extracted form data
                                )
                                decision_type = quit_decision.get("type", "continue").lower()
                                decision_reason = quit_decision.get("reason", "")
                                log(f"LLM decision: {decision_type} - {decision_reason}")
                                
                                if decision_type == "done":
                                    log("STOP: LLM recommends quitting loop. Stopping execution.")
                                    task_completed = False
                                    break  # Exit step loop
                                else:
                                    log("SUCCESS: LLM recommends continuing. Proceeding with caution.")
                                    # DON'T clear history - keep it for better loop detection
                            except Exception as e:
                                log(f"Loop detection analysis failed: {e}")
                    
                    # Log failure - loop detection will handle retries
                    if not action_executed:
                        log(f"WARNING: Action failed - loop detection will handle if this becomes a pattern")
                    
                    if not action_executed and action_type == "click" and not selector and target_text:
                        log(f"Failed to execute click action for: {target_text}, continuing to next step")

                    self.dataset.append({
                        "task": task,
                        "step": step_counter,
                        "plan_step": step_num,
                        "type": "interact",
                        "description": step_desc,
                        "screenshot_path": screenshot_path,
                        "url": page.url,
                        "action": action,
                    })

                elif step_type == "verify":
                    # Skip screenshot during verification unless it's the final check
                    is_final_verify = (step_counter >= total_steps + max_extra_cycles - 1)
                    
                    screenshot_path = None
                    if is_final_verify:
                        try:
                            screenshot_path = await self.browser.capture_screen(run_id, step_counter)
                            log(f"Final verification screenshot saved: {screenshot_path}")
                        except Exception as screenshot_error:
                            log(f"Screenshot failed: {str(screenshot_error)[:80]}")
                    else:
                        log("Skipping screenshot for interim verification step")
                    
                    log(f"Verification step: {step_desc} - Current URL: {page.url}")
                    completed, partial, reasons = await self._evaluate_completion(page, task, app_name)
                    if completed:
                        log("COMPLETE: Verification heuristics confirm completion")
                        task_completed = True
                    elif partial:
                        log(" Partial progress detected; not fully complete")
                    else:
                        log("ERROR: Verification did not find completion indicators")
                    # Record verification details
                    self.dataset.append({
                        "task": task,
                        "step": step_counter,
                        "plan_step": step_num,
                        "type": "verify",
                        "description": step_desc,
                        "screenshot_path": screenshot_path,
                        "url": page.url,
                        "verification": {
                            "completed": completed,
                            "partial": partial,
                            "reasons": reasons,
                        },
                    })

            except Exception as e:
                log(f"Error in step {step_num}: {e}")
                consecutive_errors += 1
                
                # Check if we've hit too many errors
                if consecutive_errors >= max_consecutive_errors:
                    log(f"WARNING:  Too many consecutive errors ({consecutive_errors}). Stopping task execution.")
                    break
                
                # Don't update last_action_time on error - let inactivity timeout handle it
                continue
        
        # Check if task was completed successfully
        # Adaptive extra interaction cycles if not complete after planned steps
        extra_cycles = 0
        adaptive_action_history: List[dict] = []  # Separate history for adaptive phase
        adaptive_quit_checks = 0
        
        if not task_completed and consecutive_errors < max_consecutive_errors:
            log(f"Extending execution beyond planned {total_steps} steps for adaptive completion attempts")
            while extra_cycles < max_extra_cycles and not task_completed:
                # Inactivity safeguard
                if time.time() - last_action_time > max_inactivity_seconds:
                    log(f"WARNING:  Inactivity timeout during adaptive phase ({time.time() - last_action_time:.1f}s)")
                    break
                # Check if page is still valid
                if page.is_closed():
                    log("WARNING:  Page closed during adaptive cycles; stopping")
                    break
                extra_cycles += 1
                cycle_id = f"adaptive_{extra_cycles}"
                try:
                    screenshot_path = await self.browser.capture_screen(run_id, step_counter + extra_cycles)
                    dom_html = await page.content()
                    elements_summary = parse_dom(dom_html)
                    observation = {"url": page.url, "elements": elements_summary}
                    goal_desc = f"Adaptive cycle {extra_cycles}: continue task -> {task}"[:300]
                    log(f"Adaptive cycle {extra_cycles}: querying vision agent for further progress")
                    last_action_time = time.time()
                    action = await self.vision_agent.decide_next_action(
                        screenshot_path=screenshot_path,
                        goal=goal_desc,
                        observation=observation,
                        previous_actions=[],
                        form_data=form_data,  # Pass extracted form data
                    )
                    log(f"Adaptive action: {action}")
                    action_type = action.get("type")
                    selector = action.get("selector")
                    value = action.get("value")
                    target_text = action.get("target_text", "")
                    # Basic execution (reuse browser manager)
                    executed = False
                    try:
                        if selector and ":contains(" in selector:
                            selector = None
                        executed = await self.browser.execute_action(action_type, selector, value)
                        if not executed and action_type == "click" and target_text:
                            executed = await self.browser.smart_click_by_text(target_text)
                        
                        # Record adaptive action for loop detection
                        adaptive_action_history.append({
                            "type": action_type,
                            "target_text": target_text,
                            "selector": selector,
                            "url": page.url,
                            "executed": executed,
                        })
                        
                        # Check for loops in adaptive phase
                        if len(adaptive_action_history) >= 4 and len(adaptive_action_history) % 2 == 0:
                            is_loop, loop_reason = self._detect_loop(adaptive_action_history)
                            if is_loop and adaptive_quit_checks == 0:  # Only ask once in adaptive
                                adaptive_quit_checks += 1
                                log(f"LOOP: ADAPTIVE LOOP DETECTED: {loop_reason}")
                                log("SCREENSHOT: Analyzing if adaptive cycles are productive...")
                                try:
                                    loop_screenshot = await self.browser.capture_screen(run_id, step_counter + extra_cycles + 0.8)
                                    loop_observation = {"url": page.url, "elements": parse_dom(await page.content())}
                                    loop_prompt = f"""ADAPTIVE LOOP: {loop_reason}

Task: {task}
Adaptive cycle: {extra_cycles}

We're in adaptive completion phase. Analyze screenshot: are we making ANY progress or should we quit?
Type 'continue' to persist or 'done' to quit gracefully."""
                                    loop_decision = await self.vision_agent.decide_next_action(
                                        screenshot_path=loop_screenshot,
                                        goal=loop_prompt,
                                        observation=loop_observation,
                                        previous_actions=[],
                                        form_data=form_data,  # Pass extracted form data
                                    )
                                    if loop_decision.get("type", "").lower() == "done":
                                        log("STOP: Quitting adaptive cycles per LLM recommendation")
                                        break  # Exit adaptive while loop
                                    else:
                                        log("SUCCESS: Continuing adaptive cycles")
                                        adaptive_action_history = []  # Clear for fresh attempt
                                except Exception:
                                    pass
                        
                        # Adaptive cycle stuck detection: if action fails, immediately try screenshot analysis
                        if not executed:
                            log(" Adaptive action failed; analyzing screenshot for alternative...")
                            try:
                                stuck_screenshot = await self.browser.capture_screen(run_id, step_counter + extra_cycles + 0.5)
                                stuck_observation = {"url": page.url, "elements": parse_dom(await page.content())}
                                stuck_goal = f"STUCK in adaptive cycle {extra_cycles}: Action failed. Analyze screenshot and find alternative approach for: {task}"
                                recovery_action = await self.vision_agent.decide_next_action(
                                    screenshot_path=stuck_screenshot,
                                    goal=stuck_goal,
                                    observation=stuck_observation,
                                    previous_actions=[],
                                    form_data=form_data,  # Pass extracted form data
                                )
                                log(f"Recovery action: {recovery_action}")
                                r_type = recovery_action.get("type")
                                r_selector = recovery_action.get("selector")
                                r_value = recovery_action.get("value")
                                r_target = recovery_action.get("target_text", "")
                                if r_selector and ":contains(" in r_selector:
                                    r_selector = None
                                executed = await self.browser.execute_action(r_type, r_selector, r_value)
                                if not executed and r_type == "click" and r_target:
                                    executed = await self.browser.smart_click_by_text(r_target)
                                if executed:
                                    log("SUCCESS: Recovery action succeeded")
                            except Exception as rec_err:
                                log(f"Recovery attempt failed: {rec_err}")
                    except Exception as e:
                        log(f"Adaptive action execution error: {e}")
                        if action_type == "click" and target_text:
                            executed = await self.browser.smart_click_by_text(target_text)
                        if action_type == "type" and not selector and target_text:
                            # attempt generic input fill
                            try:
                                loc = page.locator("input[type='text']")
                                if await loc.count():
                                    await loc.first.fill(value or "")
                                    executed = True
                            except Exception:
                                pass
                    # Periodic verification every 3 cycles
                    if extra_cycles % 3 == 0:
                        completed, partial, reasons = await self._evaluate_completion(page, task, app_name)
                        self.dataset.append({
                            "task": task,
                            "step": step_counter + extra_cycles,
                            "plan_step": None,
                            "type": "verify",
                            "description": f"Adaptive verification cycle {extra_cycles}",
                            "screenshot_path": screenshot_path,
                            "url": page.url,
                            "verification": {"completed": completed, "partial": partial, "reasons": reasons},
                        })
                        if completed:
                            task_completed = True
                            log("COMPLETE: Completion detected during adaptive cycles")
                            break
                        elif partial:
                            log(" Partial progress detected during adaptive cycles")
                    # brief pause to avoid hammering
                    await asyncio.sleep(1)
                except Exception as e:
                    log(f"Adaptive cycle error: {e}")
                    break

        # Final completion decision summary
        if task_completed:
            log("COMPLETE: Task execution completed (heuristics confirmed)")
        else:
            verify_entries = [d for d in self.dataset if d.get("type") == "verify"]
            any_partial = any(v.get("verification", {}).get("partial") for v in verify_entries)
            if any_partial:
                log(f" Task partially complete after {step_counter} planned + {extra_cycles} adaptive cycles")
            else:
                log(f"WARNING:  Task still incomplete after {step_counter} planned + {extra_cycles} adaptive cycles")
        
        # ========================================================================
        # GENERIC TASK VERIFICATION SYSTEM (Works for ANY web application)
        # ========================================================================
        log("\n" + "="*70)
        log("PERFORMING GENERIC TASK VERIFICATION")
        log("="*70)
        
        # Initialize generic verifier
        verifier = GenericTaskVerifier()
        
        # Calculate execution metrics
        execution_time = time.time() - start_time if 'start_time' in locals() else 0
        
        # Get initial and final URLs
        initial_url = self.dataset[0].get("url", "") if self.dataset else start_url
        final_url = page.url if page and not page.is_closed() else ""
        
        # Perform generic verification
        verification_result = verifier.verify_task_completion(
            task=task,
            dataset=self.dataset,
            initial_url=initial_url,
            final_url=final_url,
            execution_time=execution_time
        )
        
        # Update task completion based on verification
        if verification_result.status == "success":
            task_completed = True
            log(f"\n✅ TASK COMPLETED SUCCESSFULLY (100% verified)")
            log(f"   All completion criteria met:")
            log(f"   ✓ Workflow progression verified")
            log(f"   ✓ All required actions performed")
            log(f"   ✓ Success indicators detected")
            log(f"   ✓ No errors found")
        elif verification_result.status == "partial":
            task_completed = False
            any_partial = True
            log(f"\n⚠️  TASK PARTIALLY COMPLETED")
            log(f"   Some steps completed but task not 100% complete")
            log(f"   Evidence score: {verification_result.completion_percentage}%")
            log(f"   Top reasons:")
            for reason in verification_result.reasons[:3]:
                log(f"     {reason}")
        else:
            task_completed = False
            log(f"\n❌ TASK FAILED")
            log(f"   Task did not complete successfully")
            log(f"   Evidence score: {verification_result.completion_percentage}%")
            log(f"   Top reasons:")
            for reason in verification_result.reasons[:3]:
                log(f"     {reason}")
        
        # Take final proof screenshot
        try:
            proof_screenshot = await self.browser.capture_screen(run_id, step_counter + extra_cycles + 0.9)
            log(f"Final screenshot saved: {proof_screenshot}")
        except Exception as ss_err:
            proof_screenshot = None
            log(f"Could not capture final screenshot: {ss_err}")
        
        # Add generic verification to dataset
        self.dataset.append({
            "task": task,
            "step": step_counter + extra_cycles + 1,
            "plan_step": None,
            "type": "final_verification",
            "description": "Generic task verification (works for any application)",
            "screenshot_path": proof_screenshot,
            "url": final_url,
            "verification": {
                "status": verification_result.status,
                "completed": task_completed,
                "completion_percentage": verification_result.completion_percentage,
                "confidence": verification_result.confidence,
                "reasons": verification_result.reasons,
                "evidence": verification_result.evidence
            },
        })
        
        # Complete learning tracking
        verify_entries = [d for d in self.dataset if d.get("type") == "verify" or d.get("type") == "final_verification"]
        completion_status = verification_result.status  # Use generic status: "success", "partial", "failure"
        verification_results = {
            "generic_verification": {
                "status": verification_result.status,
                "completion_percentage": verification_result.completion_percentage,
                "confidence": verification_result.confidence,
                "reasons": verification_result.reasons
            },
            "checks": [v.get("verification") for v in verify_entries],
            "final_url": final_url,
        }
        
        self.workflow_learner.complete_execution(
            success=task_completed,
            completion_status=completion_status,
            verification_results=verification_results
        )
        
        # Log learning statistics
        stats = self.workflow_learner.get_statistics()
        log(f"Learning stats: {stats['success_rate']:.1f}% success rate, "
            f"{stats['learned_patterns']} patterns, {stats['known_failures']} known failures")
        
        # ========================================
        # EXECUTION SUMMARY
        # ========================================
        log("")
        log("=" * 80)
        log("WORKFLOW EXECUTION SUMMARY")
        log("=" * 80)
        log(f"Task: {task}")
        log(f"Status: {verification_result.status.upper()}")
        log(f"Completion: {verification_result.completion_percentage}%")
        log(f"Confidence: {verification_result.confidence}%")
        log(f"Steps Planned: {total_steps}")
        log(f"Steps Executed: {step_counter}")
        log(f"Final URL: {final_url}")
        log("")
        log("Verification Reasons:")
        for i, reason in enumerate(verification_result.reasons, 1):
            log(f"  {i}. {reason}")
        log("")
        
        if action_history:
            log("Action History:")
            success_count = sum(1 for a in action_history if a.get('executed'))
            failed_count = len(action_history) - success_count
            log(f"  Total Actions: {len(action_history)}")
            log(f"  Successful: {success_count}")
            log(f"  Failed: {failed_count}")
            log("")
            log("  Recent Actions:")
            for i, action in enumerate(action_history[-5:], 1):
                status = "✓" if action.get('executed') else "✗"
                action_desc = f"{action.get('type')} '{action.get('target_text', '')}'"
                log(f"    {status} {action_desc}")
        
        log("=" * 80)
        log("")

        # Persist dataset
        if self.dataset:
            dataset_path = f"{settings.SCREENSHOT_DIR}/{run_id}/plan_execution_manifest.json"
            
            # Add completion metadata with GENERIC status
            # Determine partial flag
            verify_entries = [d for d in self.dataset if d.get("type") == "verify" or d.get("type") == "final_verification"]
            
            # Get final verification result
            final_verification = next((d for d in reversed(self.dataset) if d.get("type") == "final_verification"), None)
            
            if final_verification and final_verification.get("verification"):
                final_status = final_verification["verification"].get("status", "failure")
                completion_pct = final_verification["verification"].get("completion_percentage", 0)
            else:
                final_status = "failure"
                completion_pct = 0
            
            self.dataset.append({
                "task": task,
                "completion_status": final_status,  # "success", "partial", or "failure"
                "completion_percentage": completion_pct,
                "total_steps_planned": total_steps,
                "steps_executed": step_counter,
                "run_id": run_id,
                "timestamp": time.time(),
                "details": {
                    "verify_checks": [v.get("verification") for v in verify_entries],
                    "final_verification": final_verification.get("verification") if final_verification else None
                }
            })
            
            save_json(self.dataset, dataset_path)
            log(f"Plan execution data saved to {dataset_path}")
            
            # Always generate report to show what happened (complete or incomplete)
            log("Analyzing screenshots and generating narrative report...")
            try:
                analyzer = ScreenshotAnalyzer()
                run_dir = Path(settings.SCREENSHOT_DIR) / run_id
                report_path = await analyzer.generate_narrative(
                    dataset=self.dataset,
                    task=task,
                    run_dir=run_dir,
                )
                self.report_path = report_path  # Store the report path
                log(f"SUCCESS: Execution report generated: {report_path}")
                log(f"         Open in browser: file://{report_path}")
            except Exception as e:
                log(f"Failed to generate narrative report: {e}")
                import traceback
                log(f"Error details: {traceback.format_exc()}")
            
            # Generate VisionAgent comprehensive report with video learning
            log("Generating comprehensive report based on learned patterns...")
            try:
                # Extract actions from dataset
                actions_taken = []
                for entry in self.dataset:
                    if entry.get("action"):
                        actions_taken.append({
                            "type": entry["action"].get("action_type", "unknown"),
                            "reason": entry["action"].get("reasoning", ""),
                            "success": entry.get("success", False)
                        })
                
                # Get final state
                final_state = {
                    "success": task_completed,
                    "url": self.browser.page.url if self.browser.page else "",
                    "verified": task_completed
                }
                
                # Generate comprehensive report with video learning
                vision_report = await self.vision_agent.generate_comprehensive_report(
                    task=task,
                    actions_taken=actions_taken,
                    success=task_completed,
                    final_state=final_state
                )
                
                # Save VisionAgent report
                vision_report_path = Path(settings.SCREENSHOT_DIR) / run_id / "vision_report.md"
                vision_report_path.parent.mkdir(parents=True, exist_ok=True)
                vision_report_path.write_text(vision_report)
                log(f"SUCCESS: VisionAgent comprehensive report generated: {vision_report_path}")
                log(f"         Open in text editor: {vision_report_path}")
            except Exception as e:
                log(f"Failed to generate VisionAgent comprehensive report: {e}")
                import traceback
                log(f"Error details: {traceback.format_exc()}")
        
        # Browser closure policy: only auto-close on confirmed completion or hard timeouts
        if task_completed:
            log("Closing browser (task complete)")
            await asyncio.sleep(2)
            await self.browser.close()
        else:
            log("Leaving browser open for manual inspection (Ctrl+C to terminate). Will auto-close after grace period if idle.")
            try:
                grace_seconds = int(os.getenv("GRACE_SECONDS", "30"))
            except ValueError:
                grace_seconds = 30
            start_grace = time.time()
            while time.time() - start_grace < grace_seconds:
                await asyncio.sleep(5)
            log("Grace period elapsed; closing browser.")
            await self.browser.close()

    async def _check_and_handle_signin(self, page: Page, login_url: Optional[str] = None) -> None:
        """Check if page requires sign-in and handle authentication.
        
        This method:
        1. Looks for sign-in/login buttons on the page (typically in header/top right)
        2. If found, uses AuthManager to authenticate via Google Sign-In or credentials
        3. Handles both "Sign in with Google" and traditional email/password flows
        
        Args:
            page: The Playwright page to check and authenticate
            login_url: Optional specific login URL to use
        """
        try:
            import asyncio
            
            # First check if we're already logged in
            logout_indicators = [
                "button:has-text('Log out')",
                "button:has-text('Sign out')",
                "button:has-text('Logout')",
                "[data-testid='user-menu']",
                "[data-testid='profile-menu']",
                "a[href*='logout']",
                "a[href*='signout']",
                "[aria-label*='Account']",
                "[aria-label*='Profile']",
            ]
            
            for selector in logout_indicators:
                try:
                    if await page.locator(selector).count() > 0:
                        log("✓ Already logged in (found user menu/logout button)")
                        return
                except Exception:
                    pass
            
            # Look for sign-in buttons (typically in header, top right)
            signin_selectors = [
                # Top navigation sign-in buttons
                "header button:has-text('Sign in')",
                "header button:has-text('Log in')",
                "header button:has-text('Login')",
                "header a:has-text('Sign in')",
                "header a:has-text('Log in')",
                "header a:has-text('Login')",
                
                # Nav bar sign-in buttons
                "nav button:has-text('Sign in')",
                "nav button:has-text('Log in')",
                "nav a:has-text('Sign in')",
                "nav a:has-text('Log in')",
                
                # Generic sign-in buttons
                "button:has-text('Sign in')",
                "button:has-text('Log in')",
                "button:has-text('Login')",
                "a:has-text('Sign in')",
                "a:has-text('Log in')",
                "a:has-text('Login')",
                
                # Data attributes
                "[data-testid*='signin']",
                "[data-testid*='login']",
                "[aria-label*='Sign in']",
                "[aria-label*='Log in']",
            ]
            
            signin_button = None
            used_selector = None
            
            for selector in signin_selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        # Get visible buttons only
                        if await locator.first.is_visible():
                            signin_button = locator.first
                            used_selector = selector
                            log(f"✓ Found sign-in button: {selector}")
                            break
                except Exception:
                    continue
            
            if not signin_button:
                log("No sign-in button detected on page - proceeding without authentication")
                return
            
            # Click the sign-in button
            log("Clicking sign-in button...")
            await signin_button.click()
            await asyncio.sleep(2)
            
            # Wait for login page/modal to appear
            await page.wait_for_load_state("networkidle", timeout=5000)
            
            # Use AuthManager to handle authentication
            if self.auth:
                log("Using AuthManager to handle authentication...")
                await self.auth.ensure_logged_in(page, login_url)
            else:
                log("⚠ No AuthManager configured - cannot complete authentication")
                
        except Exception as e:
            log(f"Sign-in check completed with note: {str(e)[:100]}")
            # Non-critical - continue with workflow even if sign-in check fails