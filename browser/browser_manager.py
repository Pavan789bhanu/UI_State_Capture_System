"""Manage Playwright browser contexts and pages.

BrowserManager abstracts the low level Playwright API, providing a
simple interface for starting a persistent browser, capturing
screenshots, discovering interactive elements and executing basic
actions such as clicking and typing.

Persistent contexts are created based off of the `USER_DATA_DIR`
configured in `config.py`, allowing the browser to reuse cookies,
local storage and other ondisk state across runs. This means you can
log in once manually and subsequent runs will continue to use the
stored session.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from playwright.async_api import async_playwright, BrowserContext, Page

from config import USER_DATA_DIR, TIMEOUT, SCREENSHOT_DIR
from utils.logger import log


class BrowserManager:
    """Encapsulates Playwright browser management.

    A single instance of this class owns the Playwright context and a
    tab (`page`). It provides methods for starting the browser,
    capturing screenshots and executing actions.
    """

    def __init__(self, user_data_dir: str | None = None, headless: bool = False) -> None:
        self.user_data_dir = user_data_dir or USER_DATA_DIR
        self.headless = headless
        self.playwright = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    async def start(self) -> None:
        """Start a persistent browser context.

        Launches a Chromium browser using a persistent context. If the
        directory at `self.user_data_dir` exists, it is reused and the
        session state (cookies, local storage, etc.) will persist
        between runs. If the directory does not exist it will be
        created on the fly.
        """
        # Ensure the user data directory exists.
        Path(self.user_data_dir).mkdir(parents=True, exist_ok=True)

        log(f"Launching browser with user data dir: {self.user_data_dir}")
        self.playwright = await async_playwright().start()

        # Allow opting out of persistence if lock conflicts occur repeatedly.
        disable_persistent = os.getenv("DISABLE_PERSISTENT", "false").lower() == "true"
        attempt_persistent = not disable_persistent
        lock_path = Path(self.user_data_dir) / "SingletonLock"
        retry_count = 0
        max_retries = 2
        last_error: Optional[Exception] = None

        while attempt_persistent and retry_count < max_retries:
            attempt_number = retry_count + 1
            try:
                self.context = await self.playwright.chromium.launch_persistent_context(
                    user_data_dir=self.user_data_dir,
                    headless=self.headless,
                    viewport={"width": 1280, "height": 800},
                    args=["--start-maximized"],
                )
                log("Persistent context launched successfully")
                break
            except Exception as e:
                last_error = e
                retry_count += 1
                log(f"Persistent context launch failed (attempt {attempt_number}/{max_retries}): {e}")
                # If lock file exists remove and retry once more
                if lock_path.exists():
                    try:
                        lock_path.unlink()
                        log("Removed stale SingletonLock; retrying...")
                    except Exception as rm_err:
                        log(f"Failed to remove SingletonLock: {rm_err}")
                await asyncio.sleep(0.5)
                if retry_count >= max_retries:
                    attempt_persistent = False
                    log("Falling back to ephemeral context due to repeated persistent failures")

        if not self.context:
            # Fallback: launch non-persistent ephemeral context
            browser = await self.playwright.chromium.launch(headless=self.headless)
            self.context = await browser.new_context(viewport={"width":1280, "height":800})
            log("Ephemeral browser context launched (no persistence)")
            if last_error:
                log(f"Original persistent error: {last_error}")
        # Grab the first page or create a new one if none exist.
        if self.context.pages:
            self.page = self.context.pages[0]
        else:
            self.page = await self.context.new_page()
        # Set default timeout for all operations.
        self.context.set_default_timeout(TIMEOUT)
        # Log persistence mode
        if attempt_persistent and retry_count <= max_retries and last_error is None:
            log("Browser running in persistent mode")
        else:
            log("Browser running in ephemeral mode (persistence disabled or failed)")

    async def capture_screen(self, run_id: str, step_index: int) -> str:
        """Take a screenshot of the current page and return its path.

        Automatically dismisses popups, cookie banners, and overlays before
        capturing to ensure clean screenshots for better analysis.

        Screenshots are stored under `SCREENSHOT_DIR/<run_id>/step_<n>.png`.

        Args:
            run_id: Unique identifier for the current run (e.g. a timestamp).
            step_index: Index of the current step in the workflow.

        Returns:
            The absolute path to the saved screenshot.
        """
        assert self.page is not None, "Browser must be started before capturing screenshots"
        
        # Dismiss overlays only if this appears to be an initial screenshot (step < 5)
        # This prevents interference with action validation in later steps
        if step_index < 5:
            try:
                dismissed = await self.dismiss_overlays()
                if dismissed:
                    log("Overlays/popups dismissed before screenshot")
                # Brief wait for any animations to complete
                await asyncio.sleep(0.5)
            except Exception as e:
                log(f"Warning: Could not dismiss overlays: {str(e)[:60]}")
        
        # Create the run directory if it doesn't already exist.
        run_dir = Path(SCREENSHOT_DIR) / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        # Save the screenshot to disk with retry logic
        screenshot_path = run_dir / f"step_{step_index}.png"
        max_retries = 2
        for attempt in range(max_retries):
            try:
                await self.page.screenshot(path=str(screenshot_path), timeout=5000)
                log(f"Captured screenshot: {screenshot_path}")
                return str(screenshot_path)
            except Exception as e:
                if attempt < max_retries - 1:
                    log(f"Screenshot attempt {attempt+1} failed: {str(e)[:60]}, retrying...")
                    await asyncio.sleep(0.5)
                else:
                    log(f"Screenshot failed after {max_retries} attempts: {str(e)[:60]}")
                    # Create a blank placeholder
                    raise
        return str(screenshot_path)

    async def get_interactive_elements(self) -> List[Dict[str, Any]]:
        """Return a list of simple descriptors for clickable elements.

        This method uses a small JavaScript snippet to identify buttons,
        anchors, inputs and other elements that might be interacted with.

        Returns:
            A list of dictionaries with basic information about
            interactive elements on the page.
        """
        assert self.page is not None, "Browser must be started before getting elements"
        elements = await self.page.evaluate(
            """() => {
                const candidates = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
                return candidates.map((el, index) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return null;
                    return {
                        index: index,
                        tag: el.tagName.toLowerCase(),
                        text: el.innerText.trim().slice(0, 50) || el.getAttribute('aria-label') || el.placeholder || '',
                    };
                }).filter(item => item !== null);
            }""",
        )
        return elements

    async def execute_action(
        self,
        action_type: str,
        selector: Optional[str] = None,
        value: Optional[str] = None,
        coordinates: Optional[Tuple[int, int]] = None,
    ) -> bool:
        """Execute a basic action on the page.

        Supported action types include 'click', 'type', 'wait', 'keyboard' and
        'scroll'. If a selector is provided for click and type actions the
        element at that selector will be used; otherwise if coordinates are
        provided the click will occur at the given x/y position. The
        function waits for network idle after performing the action to
        allow the UI to settle.

        Args:
            action_type: The type of action to perform.
            selector: A CSS selector or Playwright locator text to target.
            value: Text to type or key to press, depending on the action.
            coordinates: A tuple of x/y coordinates for click actions.

        Returns:
            True if the action executed without raising an exception, False
            otherwise.
        """
        assert self.page is not None, "Browser must be started before executing actions"
        try:
            if action_type == "click":
                # Track current pages and URL before click
                pages_before = len(self.context.pages) if self.context else 0
                current_url = self.page.url
                
                if selector:
                    log(f"Clicking element via selector: {selector}")
                    
                    # Listen for new pages (popups/tabs) during click
                    async def handle_popup(popup):
                        log(f"SUCCESS: New tab/popup detected: {popup.url}")
                        self.page = popup
                        try:
                            await popup.wait_for_load_state("domcontentloaded", timeout=5000)
                            log(f"SUCCESS: New tab loaded: {popup.url}")
                        except Exception as e:
                            log(f"WARNING: New tab load timeout: {e}")
                    
                    # Set up popup handler before click
                    if self.context:
                        self.context.on("page", handle_popup)
                    
                    # Try to click on main page first
                    clicked = False
                    try:
                        await self.page.click(selector, timeout=3000)
                        clicked = True
                    except Exception as main_err:
                        log(f"Element not found on main page: {main_err}")
                        # Try to find in iframes
                        try:
                            log(f"Searching for selector '{selector}' in iframes...")
                            for frame in self.page.frames:
                                if frame == self.page.main_frame:
                                    continue
                                try:
                                    # Check if element exists in this frame
                                    loc = frame.locator(selector)
                                    if await loc.count() > 0:
                                        await loc.first.click(timeout=3000)
                                        clicked = True
                                        log(f"SUCCESS: Clicked element in iframe: {selector}")
                                        break
                                except Exception:
                                    continue
                        except Exception as iframe_err:
                            log(f"Failed to search iframes: {iframe_err}")
                    
                    if not clicked:
                        raise Exception(f"Could not find or click element: {selector}")
                    
                    # Wait briefly for popup to be detected
                    await asyncio.sleep(1.0)
                    
                    # Remove handler
                    if self.context:
                        self.context.remove_listener("page", handle_popup)
                    
                    # Also check if URL changed on same page
                    if self.page.url != current_url:
                        log(f"Navigation detected: {current_url} → {self.page.url}")
                        
                elif coordinates:
                    x, y = coordinates
                    log(f"Clicking at coordinates: {x}, {y}")
                    await self.page.mouse.click(x, y)
                else:
                    raise ValueError("Click action requires either a selector or coordinates")
                
                # Wait briefly for new tab/popup to open
                await asyncio.sleep(0.5)
                
                # Check if new tab/popup opened
                if self.context:
                    pages_after = len(self.context.pages)
                    if pages_after > pages_before:
                        # New tab opened - switch to it
                        new_page = self.context.pages[-1]
                        log(f"SUCCESS: New tab detected, switching from {self.page.url} to new tab")
                        self.page = new_page
                        # Wait for new page to load
                        try:
                            await self.page.wait_for_load_state("domcontentloaded", timeout=5000)
                            log(f"SUCCESS: Switched to new tab: {self.page.url}")
                        except Exception as load_err:
                            log(f"WARNING: New tab load timeout: {load_err}")
            elif action_type == "type":
                if not selector or value is None:
                    raise ValueError("Type action requires selector and value")
                log(f"Typing into {selector}: {value}")
                await self.page.fill(selector, value)
            elif action_type == "keyboard":
                if not value:
                    raise ValueError("Keyboard action requires a key value")
                log(f"Pressing key: {value}")
                await self.page.keyboard.press(value)
            elif action_type == "wait":
                # Wait for a couple of seconds to let animations or
                # navigations complete. This is intentionally long to
                # accommodate slower pages.
                seconds = float(value) if value else 2.0
                log(f"Waiting for {seconds} seconds")
                await asyncio.sleep(seconds)
            elif action_type == "scroll":
                # Scroll by the given delta. Value must be a tuple of x/y
                # offsets; we default to vertical scroll.
                dx, dy = (coordinates or (0, 400))
                log(f"Scrolling by dx={dx}, dy={dy}")
                await self.page.mouse.wheel(dx, dy)
            elif action_type == "done":
                # Terminal action - just wait and return success
                log("Task marked as done by LLM")
                return True
            else:
                log(f"Unknown action type: {action_type}; treating as wait")
                # Treat unknown actions as a wait
                await asyncio.sleep(2.0)

            # Wait for network to settle. Not all actions cause network
            # requests; if the wait times out we ignore the error.
            try:
                await self.page.wait_for_load_state("networkidle", timeout=3000)
            except Exception:
                pass
            # Additional small sleep to handle CSS animations.
            await asyncio.sleep(1.0)
            return True
        except Exception as e:
            log(f"Action execution error: {e}")
            return False

    async def smart_click_by_text(self, target_text: str) -> bool:
        """Attempt to click an element identified only by visible text.

        Tries multiple strategies (role button, link, generic text, XPath).
        Also searches within iframes for OAuth popups and overlays.
        Returns True if a click was executed.
        """
        assert self.page is not None, "Browser must be started before executing actions"
        page = self.page
        if not target_text:
            return False
        
        # Track current URL before click
        current_url = page.url
        clicked = False
        
        # Listen for new pages during click
        async def handle_popup(popup):
            log(f"SUCCESS: New tab detected via smart_click: {popup.url}")
            self.page = popup
            try:
                await popup.wait_for_load_state("domcontentloaded", timeout=5000)
                log(f"SUCCESS: New tab loaded: {popup.url}")
            except Exception as e:
                log(f"WARNING: New tab load timeout: {e}")
        
        if self.context:
            self.context.on("page", handle_popup)
        
        # First try main page
        try:
            # Role button exact
            btn = page.get_by_role("button", name=target_text)
            if await btn.count():
                await btn.first.click()
                clicked = True
                log(f"SUCCESS: smart_click: button '{target_text}'")
        except Exception:
            pass
        
        if not clicked:
            try:
                link = page.get_by_role("link", name=target_text)
                if await link.count():
                    await link.first.click()
                    clicked = True
                    log(f"SUCCESS: smart_click: link '{target_text}'")
            except Exception:
                pass
        
        if not clicked:
            try:
                # Partial text search case-insensitive
                text_element = page.get_by_text(target_text, exact=False)
                if await text_element.count():
                    await text_element.first.click()
                    clicked = True
                    log(f"SUCCESS: smart_click: text contains '{target_text}'")
            except Exception:
                pass
        
        if not clicked:
            try:
                # XPath contains
                xpath = f"//button[contains(normalize-space(.), '{target_text}')] | //a[contains(normalize-space(.), '{target_text}')] | //*[@role='button'][contains(normalize-space(.), '{target_text}')]"
                loc = page.locator(xpath)
                if await loc.count():
                    await loc.first.click()
                    clicked = True
                    log(f"SUCCESS: smart_click: XPath '{target_text}'")
            except Exception:
                pass
        
        # If not found on main page, search in all iframes (OAuth popups, overlays)
        if not clicked:
            try:
                log(f"Searching for '{target_text}' in iframes...")
                frames = page.frames
                for frame in frames:
                    if frame == page.main_frame:
                        continue  # Already checked main frame
                    
                    try:
                        # Try button role in iframe
                        btn = frame.get_by_role("button", name=target_text)
                        if await btn.count():
                            await btn.first.click()
                            clicked = True
                            log(f"SUCCESS: smart_click in iframe: button '{target_text}'")
                            break
                    except Exception:
                        pass
                    
                    if not clicked:
                        try:
                            # Try text search in iframe
                            text_element = frame.get_by_text(target_text, exact=False)
                            if await text_element.count():
                                await text_element.first.click()
                                clicked = True
                                log(f"SUCCESS: smart_click in iframe: text '{target_text}'")
                                break
                        except Exception:
                            pass
                    
                    if not clicked:
                        try:
                            # Try XPath in iframe
                            xpath = f"//button[contains(normalize-space(.), '{target_text}')] | //a[contains(normalize-space(.), '{target_text}')] | //*[@role='button'][contains(normalize-space(.), '{target_text}')]"
                            loc = frame.locator(xpath)
                            if await loc.count():
                                await loc.first.click()
                                clicked = True
                                log(f"SUCCESS: smart_click in iframe via XPath: '{target_text}'")
                                break
                        except Exception:
                            pass
            except Exception as e:
                log(f"WARNING: Error searching iframes: {e}")
        
        # Remove popup handler
        if self.context:
            self.context.remove_listener("page", handle_popup)
        
        if not clicked:
            log(f"FAILED: smart_click: no match for '{target_text}'")
            return False
        
        # Wait for navigation or popup
        await asyncio.sleep(1.0)
        
        # Check if URL changed
        if self.page.url != current_url:
            log(f"Navigation detected: {current_url} → {self.page.url}")
        
        return True

    async def dismiss_overlays(self) -> bool:
        """Try to dismiss any open overlays, modals, dropdowns, cookie banners, and popups.
        
        This comprehensive method handles:
        - Cookie consent banners
        - Modal dialogs
        - Notification popups
        - Tour/onboarding overlays
        - Close buttons (X, ✕, etc.)
        
        Returns True if likely dismissed something.
        """
        assert self.page is not None, "Browser must be started"
        page = self.page
        dismissed = False
        
        # Strategy 1: Cookie banners - handle these first as they're most common
        try:
            cookie_patterns = [
                "Accept all", "Accept All", "Accept all cookies",
                "Accept", "I Accept", "I agree", "Yes, I agree",
                "Agree", "Agree and continue", "Got it", "OK", "Confirm",
                "Allow all", "Allow All", "Continue", "Close",
                "Reject all", "Decline", "No thanks"  # Some sites require explicit rejection
            ]
            for text in cookie_patterns:
                try:
                    btn = page.get_by_role("button", name=text)
                    if await btn.count() > 0:
                        await btn.first.click(timeout=1000)
                        await asyncio.sleep(0.3)
                        dismissed = True
                        log(f"SUCCESS: Dismissed cookie banner via '{text}' button")
                        break
                except Exception:
                    pass
        except Exception:
            pass
        
        # Strategy 2: Press Escape key (works for many modals)
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.3)
            dismissed = True
            log("SUCCESS: Pressed Escape to dismiss overlays")
        except Exception:
            pass
        
        # Strategy 3: Look for close buttons with common patterns
        try:
            close_selectors = [
                "[aria-label='Close']",
                "[aria-label='close']",
                "button[aria-label='Close']",
                "button[aria-label='Dismiss']",
                "[data-testid='modal-close']",
                "[data-testid='close-button']",
                ".modal-close",
                ".close-button",
                "button.close",
                "[class*='close']",
                "button[title='Close']",
                "button[title='Dismiss']",
                # Add visual close indicators
                "button:has-text('×')",  # multiplication sign
                "button:has-text('✕')",  # heavy X
                "[role='button']:has-text('X')"
            ]
            for sel in close_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=500):
                        await loc.click(timeout=1000)
                        await asyncio.sleep(0.3)
                        dismissed = True
                        log(f"SUCCESS: Clicked close button: {sel}")
                        break
                except Exception:
                    pass
        except Exception:
            pass
        
        # Strategy 4: Look for notification/toast dismiss buttons
        try:
            notification_texts = ["Dismiss", "Close", "✕", "×", "X", "Maybe later", "Not now", "Skip"]
            for text in notification_texts:
                try:
                    btn = page.get_by_text(text, exact=False).first
                    if await btn.is_visible(timeout=500):
                        await btn.click(timeout=1000)
                        await asyncio.sleep(0.3)
                        dismissed = True
                        log(f"SUCCESS: Dismissed notification via '{text}'")
                        break
                except Exception:
                    pass
        except Exception:
            pass
        
        # Strategy 5: Click outside modal (on backdrop/overlay)
        try:
            backdrop_selectors = [".modal-backdrop", ".overlay", "[class*='backdrop']", "[class*='overlay']"]
            for sel in backdrop_selectors:
                try:
                    backdrop = page.locator(sel).first
                    if await backdrop.is_visible(timeout=500):
                        await backdrop.click(timeout=1000)
                        await asyncio.sleep(0.3)
                        dismissed = True
                        log(f"SUCCESS: Clicked backdrop to dismiss modal: {sel}")
                        break
                except Exception:
                    pass
        except Exception:
            pass
        
        # Strategy 6: Look for elements with z-index indicating overlay (popup/banner at bottom/top)
        try:
            # Find elements with high z-index that might be popups
            high_z_elements = await page.evaluate("""
                () => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const highZ = elements.filter(el => {
                        const zIndex = parseInt(window.getComputedStyle(el).zIndex);
                        return zIndex > 999 && el.offsetHeight > 50;
                    });
                    return highZ.map(el => ({
                        tag: el.tagName,
                        text: el.innerText.substring(0, 50),
                        hasCloseButton: el.querySelector('button, [role="button"], .close, [aria-label*="close"]') !== null
                    }));
                }
            """)
            
            # If we found high-z elements with close buttons, try to close them
            if high_z_elements and len(high_z_elements) > 0:
                for elem in high_z_elements:
                    if elem.get('hasCloseButton'):
                        try:
                            # Find and click close button within high-z element
                            close_btn = page.locator('button, [role="button"], .close, [aria-label*="close"]').first
                            if await close_btn.is_visible(timeout=500):
                                await close_btn.click(timeout=1000)
                                dismissed = True
                                log(f"SUCCESS: Dismissed high-z overlay via close button")
                                break
                        except Exception:
                            pass
        except Exception:
            pass
        
        return dismissed

    async def close(self) -> None:
        """Close the browser and cleanup Playwright resources."""
        if self.context:
            await self.context.close()
            self.context = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
        log("Browser closed")