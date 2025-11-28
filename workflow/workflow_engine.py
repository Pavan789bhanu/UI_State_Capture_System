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

from browser.browser_manager import BrowserManager
from browser.auth_manager import AuthManager
from agent.vision_agent import VisionAgent
from agent.planner_agent import PlannerAgent
from utils.file_utils import save_json
from utils.logger import log
from utils.dom_parser import parse_dom
from utils.screenshot_analyzer import ScreenshotAnalyzer
from utils.url_validator import URLValidator
from config import SCREENSHOT_DIR


class WorkflowEngine:
    """Coordinate the UI capture workflow."""

    def __init__(
        self,
        browser: Optional[BrowserManager] = None,
        vision_agent: Optional[VisionAgent] = None,
        planner_agent: Optional[PlannerAgent] = None,
        auth: Optional[AuthManager] = None,
    ) -> None:
        self.browser = browser or BrowserManager()
        self.vision_agent = vision_agent or VisionAgent()
        self.planner_agent = planner_agent or PlannerAgent()
        self.auth = auth
        self.dataset: List[dict] = []
        self.url_validator = URLValidator()  # Initialize URL validator

    async def _evaluate_completion(self, page: Page, task: str, app_name: str) -> tuple[bool, bool, List[str]]:
        """Evaluate completion using strict task-based verification.

        Returns:
            (completed, partial_progress, reasons)
        """
        reasons: List[str] = []
        task_lower = task.lower()
        url_lower = page.url.lower()
        completed = False
        partial = False

        try:
            html = await page.content()
            text = html.lower()
            
            # CRITICAL: Check if page is blank or minimal
            visible_text = await page.evaluate("""
                () => {
                    const body = document.body;
                    return body ? body.innerText.trim() : '';
                }
            """)
            
            if len(visible_text) < 100:
                reasons.append("Page appears blank or minimal - likely not at completion state")
                return False, False, reasons
            
            # Extract key action verbs and nouns from task
            task_tokens = task_lower.split()
            
            # STRICT: Only mark complete if we have strong evidence
            # Pattern 1: Creation tasks (create, add, new)
            if any(verb in task_lower for verb in ["create", "add", "new", "make"]):
                # Must have BOTH success indicator AND correct context
                success_tokens = ["created successfully", "has been created", "was added", "successfully saved"]
                has_success = any(token in text for token in success_tokens)
                
                # Check if we're actually on a result/confirmation page
                confirmation_indicators = ["confirmation", "success", "complete", "created", "saved"]
                url_has_confirmation = any(ind in url_lower for ind in confirmation_indicators)
                
                if has_success and url_has_confirmation:
                    completed = True
                    reasons.append("Strong completion evidence: success message and confirmation context")
                elif has_success or url_has_confirmation:
                    partial = True
                    reasons.append("Partial completion evidence detected")
            
            # Pattern 2: Filter/search tasks
            if any(verb in task_lower for verb in ["filter", "search", "find"]):
                filter_indicators = ["filter", "search", "results", "matches"]
                if sum(1 for token in filter_indicators if token in text) >= 2:
                    partial = True
                    reasons.append("Filter/search interface detected")
            
            # Pattern 3: Navigation tasks (go to, open, view)
            if any(verb in task_lower for verb in ["open", "go to", "navigate", "view"]):
                # Check if we actually navigated somewhere relevant
                relevant_tokens = [w for w in task_tokens if len(w) > 3 and w not in ["how", "the", "open", "go", "to", "do", "i"]]
                if any(token in url_lower or token in text for token in relevant_tokens):
                    partial = True
                    reasons.append("Navigation with relevant context detected")
                
        except Exception as e:
            reasons.append(f"Completion evaluation error: {str(e)[:60]}")

        return completed, partial, reasons



    def _detect_loop(self, action_history: List[dict], window_size: int = 6) -> tuple[bool, str]:
        """Detect if we're in a repetitive loop by analyzing action patterns.
        
        Returns (is_loop, reason)
        """
        if len(action_history) < window_size:
            return False, ""
        
        recent = action_history[-window_size:]
        
        # Check 0: CRITICAL - Same action on same URL with no page change (most common loop)
        failed_same_action = 0
        for i in range(len(recent) - 1):
            curr = recent[i]
            next_action = recent[i + 1]
            if (curr.get('type') == 'click' and next_action.get('type') == 'click' and
                curr.get('target_text') == next_action.get('target_text') and
                curr.get('url') == next_action.get('url') and
                not curr.get('page_changed', False)):
                failed_same_action += 1
        
        if failed_same_action >= 2:
            return True, f"Clicking same element repeatedly with no effect ({failed_same_action} times)"
        
        # Check 1: Same action repeated multiple times
        action_signatures = [f"{a.get('type')}:{a.get('target_text','')}:{a.get('selector','')}" for a in recent]
        unique_actions = len(set(action_signatures))
        if unique_actions <= 2:
            return True, f"Action repetition: only {unique_actions} unique actions in last {window_size} steps"
        
        # Check 2: URL hasn't changed in multiple click actions
        click_actions = [a for a in recent if a.get('type') == 'click']
        if len(click_actions) >= 3:
            click_urls = [a.get('url', '') for a in click_actions]
            if len(set(click_urls)) == 1 and not any(a.get('page_changed', False) for a in click_actions):
                return True, f"Multiple clicks on same page with no effect ({len(click_actions)} clicks)"
        
        # Check 3: Alternating between 2 actions (A-B-A-B pattern)
        if len(action_signatures) >= 4:
            if (action_signatures[-1] == action_signatures[-3] and 
                action_signatures[-2] == action_signatures[-4]):
                return True, "Alternating action pattern detected (A-B-A-B)"
        
        return False, ""



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
        
        # Task completion tracking
        last_action_time = time.time()
        # Allow overriding core adaptive parameters via environment variables
        try:
            max_inactivity_seconds = int(os.getenv("INACTIVITY_SECONDS", "30"))
        except ValueError:
            max_inactivity_seconds = 30
        
        try:
            max_extra_cycles = int(os.getenv("ADAPTIVE_MAX_CYCLES", "6"))
        except ValueError:
            max_extra_cycles = 6  # fallback

        task_completed = False
        total_errors = 0
        max_consecutive_errors = 3

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
                                        await email_input.first.fill(self.auth_manager.email)
                                        log(f"✓ Filled Google OAuth email: {self.auth_manager.email}")
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
                                            await pwd_input.first.fill(self.auth_manager.password)
                                            log(f"✓ Filled Google OAuth password")
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
                                        await email_input.first.fill(self.auth_manager.email)
                                        log(f"✓ Auto-filled email: {self.auth_manager.email}")
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
                                        await pwd_input.first.fill(self.auth_manager.password)
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
                    if failed_actions:
                        failed_summary = [f"FAILED: {a.get('type')} '{a.get('target_text','')}' (no effect)" for a in failed_actions]
                        context_msg.extend(failed_summary)
                        log(f"WARNING: Passing {len(failed_actions)} failed actions to Vision Agent for awareness")
                    
                    action = await self.vision_agent.decide_next_action(
                        screenshot_path=screenshot_path,
                        goal=step_desc,
                        observation=observation,
                        previous_actions=context_msg,
                    )

                    log(f"LLM proposed action: {action}")
                    
                    # Execute the action, with better error handling
                    action_type = action.get("type")
                    selector = action.get("selector")
                    value = action.get("value")
                    target_text = action.get("target_text", "")

                    # CRITICAL: Capture state BEFORE action to validate success
                    url_before = page.url
                    dom_before_hash = hash(await page.content())
                    
                    action_executed = False
                    
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
                        action_executed = await self.browser.execute_action(action_type=action_type, selector=selector, value=value)
                        if not action_executed and action_type == "click" and target_text:
                            action_executed = await self.browser.smart_click_by_text(target_text)
                    except (ValueError, Exception) as ve:
                        log(f"Action execution error: {ve}")
                        if action_type == "click" and target_text:
                            action_executed = await self.browser.smart_click_by_text(target_text)
                    
                    # VALIDATION: Check if action actually changed the page state
                    url_after = page.url
                    dom_after_hash = hash(await page.content())
                    
                    page_changed = (url_after != url_before) or (dom_after_hash != dom_before_hash)
                    
                    if action_executed and not page_changed and action_type == "click":
                        log(f"WARNING: Action executed but page didn't change! URL: {url_before}")
                        log(f"WARNING: Clicked '{target_text or selector}' but no effect detected")
                        # Mark as failed since it had no effect
                        action_executed = False
                    elif page_changed:
                        log(f"SUCCESS: Page state changed - URL: {url_before} → {url_after}")
                    
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
                        is_loop, loop_reason = self._detect_loop(action_history, window_size=4)
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
                            is_loop, loop_reason = self._detect_loop(adaptive_action_history, window_size=4)
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

        # Persist dataset
        if self.dataset:
            dataset_path = f"{SCREENSHOT_DIR}/{run_id}/plan_execution_manifest.json"
            
            # Add completion metadata
            # Determine partial flag
            verify_entries = [d for d in self.dataset if d.get("type") == "verify"]
            any_partial = any(v.get("verification", {}).get("partial") for v in verify_entries)
            self.dataset.append({
                "task": task,
                "completion_status": "completed" if task_completed else ("partial" if any_partial else "incomplete"),
                "total_steps_planned": total_steps,
                "steps_executed": step_counter,
                "run_id": run_id,
                "timestamp": time.time(),
                "details": {
                    "verify_checks": [v.get("verification") for v in verify_entries],
                }
            })
            
            save_json(self.dataset, dataset_path)
            log(f"Plan execution data saved to {dataset_path}")
            
            # Always generate report to show what happened (complete or incomplete)
            log("Analyzing screenshots and generating narrative report...")
            try:
                analyzer = ScreenshotAnalyzer()
                run_dir = Path(SCREENSHOT_DIR) / run_id
                report_path = await analyzer.generate_narrative(
                    dataset=self.dataset,
                    task=task,
                    run_dir=run_dir,
                )
                log(f"SUCCESS: Execution report generated: {report_path}")
                log(f"         Open in browser: file://{report_path}")
            except Exception as e:
                log(f"Failed to generate narrative report: {e}")
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