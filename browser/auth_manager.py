"""Authentication helper for web applications.

The `AuthManager` encapsulates logic for logging into web applications
via traditional username/password forms. It supports saving and loading
authentication state so that subsequent runs can bypass the login
process entirely.

GENERIC AUTHENTICATION:
This manager uses a generic form-filling approach that works across
different web applications. It searches for common email/password input
patterns and handles standard login flows. If authentication fails,
it automatically attempts registration as a fallback.

The generic approach ensures compatibility with any web application
without requiring app-specific customization.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

from playwright.async_api import Page

from config import LOGIN_EMAIL, LOGIN_PASSWORD, STORAGE_STATE_PATH
from utils.logger import log


class AuthManager:
    """Authenticate into a web app and persist the session.

    Args:
        email: Email address used for login. Defaults to LOGIN_EMAIL
            environment variable.
        password: Password used for login. Defaults to LOGIN_PASSWORD
            environment variable.
        storage_state_path: Optional path where Playwright's storage
            state should be saved after a successful login. If using
            persistent contexts this file is optional.
    """

    def __init__(
        self,
        email: Optional[str] = None,
        password: Optional[str] = None,
        storage_state_path: Optional[str] = None,
    ) -> None:
        self.email = email or LOGIN_EMAIL
        self.password = password or LOGIN_PASSWORD
        self.storage_state_path = storage_state_path or STORAGE_STATE_PATH

    async def ensure_logged_in(self, page: Page, login_url: Optional[str] = None) -> None:
        """Ensure the user is logged in.

        This method navigates to `login_url` (if provided) and attempts to
        authenticate. On success the session is persisted via
        Playwright's storageState mechanism when a storage_state_path is
        provided. Subsequent runs can skip login as long as the
        underlying browser context is reused or the storage file is
        loaded into a new context.

        Args:
            page: The Playwright page to use for navigation and login.
            login_url: A URL that triggers the login page. If None,
                the current page is assumed to be at the login screen.
        """
        if not self.email or not self.password:
            log("No login credentials provided; skipping login.")
            return

        log("Checking if already logged in...")
        
        # Check if we're already logged in by looking for logout button or user menu
        import asyncio
        try:
            logout_indicators = [
                "button:has-text('Log out')",
                "button:has-text('Sign out')",
                "button:has-text('Logout')",
                "[data-testid='user-menu']",
                "[data-testid='profile-menu']",
                "a[href*='logout']",
                "a[href*='signout']",
            ]
            
            for selector in logout_indicators:
                try:
                    if await page.locator(selector).count() > 0:
                        log("Already logged in (found logout indicator).")
                        return
                except Exception:
                    pass
        except Exception:
            pass

        log("Not logged in; attempting authentication.")
        # Navigate to the login page if one is provided.
        if login_url:
            await page.goto(login_url)
            await asyncio.sleep(2)

        # Try generic username/password authentication
        log("Attempting email/password login...")
        success = await self._try_username_password(page)

        if success:
            log("Authentication successful.")
            # Persist authentication state for future runs.
            await self._save_storage_state(page)
            await self._handle_cookie_banner(page)
        else:
            log("Login failed. Attempting registration with same credentials...")
            # Try to register if login fails
            register_success = await self._try_registration(page)
            if register_success:
                log("Registration successful.")
                await self._save_storage_state(page)
                await self._handle_cookie_banner(page)
            else:
                log("Failed to authenticate automatically. You may need to log in manually.")

    async def _handle_cookie_banner(self, page: Page) -> None:
        """Attempt to accept/close cookie consent banners if present."""
        try:
            import asyncio
            await asyncio.sleep(0.5)
            patterns = [
                "Accept all", "Accept", "I Accept", "Agree", "Got it", "Confirm",
                "Allow all", "Continue", "Yes, I agree"
            ]
            for text in patterns:
                try:
                    btn = page.get_by_role("button", name=text)
                    if await btn.count() > 0:
                        await btn.first.click()
                        log(f"SUCCESS: Accepted cookies via '{text}' button")
                        return
                except Exception:
                    pass
            # Fallback generic Accept
            try:
                generic = page.locator("button").filter(has_text="Accept")
                if await generic.count() > 0:
                    await generic.first.click()
                    log("SUCCESS: Accepted cookies via generic Accept button")
            except Exception:
                pass
        except Exception as e:
            log(f"Cookie banner handling skipped: {e}")

    async def _try_username_password(self, page: Page) -> bool:
        """Attempt to authenticate via a traditional form.

        This method searches for input fields that accept email/username
        and password values, fills them with credentials and submits
        the form. It tries a few common selectors but cannot cover
        every possible login page. Returns True on success or False if
        the elements were not found.
        """
        try:
            import asyncio
            
            # Identify input for email/username.
            email_selectors = [
                "input[type='email']",
                "input[name='email']",
                "input[name='username']",
                "input[name='user']",
                "input[id*='email']",
                "input[placeholder*='email']",
                "input[placeholder*='Email']",
                "input[placeholder*='Username']",
                "input[aria-label*='email']",
                "input[aria-label*='Email']",
            ]
            email_input = None
            for sel in email_selectors:
                locator = page.locator(sel)
                if await locator.count():
                    email_input = locator.first
                    log(f"Found email input with selector: {sel}")
                    break
            if email_input is None:
                log("Could not find email input field.")
                return False
            
            await email_input.fill(self.email)
            await asyncio.sleep(0.5)

            # Identify input for password.
            password_selectors = [
                "input[type='password']",
                "input[name='password']",
                "input[name='pass']",
                "input[id*='password']",
                "input[placeholder*='Password']",
                "input[aria-label*='password']",
                "input[aria-label*='Password']",
            ]
            password_input = None
            for sel in password_selectors:
                loc = page.locator(sel)
                if await loc.count():
                    password_input = loc.first
                    log(f"Found password input with selector: {sel}")
                    break
            if password_input is None:
                log("Could not find password input field.")
                return False
            
            await password_input.fill(self.password)
            await asyncio.sleep(0.5)

            # Check for reCAPTCHA checkbox and click it if present
            try:
                log("Checking for reCAPTCHA 'I'm not a robot' checkbox...")
                recaptcha_selectors = [
                    "iframe[src*='recaptcha']",
                    "iframe[title*='reCAPTCHA']",
                    ".g-recaptcha",
                ]
                
                recaptcha_found = False
                for selector in recaptcha_selectors:
                    try:
                        recaptcha_element = page.locator(selector)
                        if await recaptcha_element.count() > 0:
                            recaptcha_found = True
                            log(f"Found reCAPTCHA element: {selector}")
                            
                            # If it's an iframe, we need to click inside it
                            if "iframe" in selector:
                                # Find the checkbox inside the iframe
                                frames = page.frames
                                for frame in frames:
                                    try:
                                        # Look for the recaptcha checkbox
                                        checkbox = frame.locator(".recaptcha-checkbox-border, #recaptcha-anchor, .recaptcha-checkbox")
                                        if await checkbox.count() > 0:
                                            log("Clicking reCAPTCHA checkbox in iframe...")
                                            await checkbox.first.click()
                                            log("✓ Successfully clicked reCAPTCHA checkbox")
                                            await asyncio.sleep(2)  # Wait for validation
                                            break
                                    except Exception:
                                        continue
                            else:
                                # Try to click the element directly
                                await recaptcha_element.first.click()
                                log("✓ Clicked reCAPTCHA element")
                                await asyncio.sleep(2)
                            break
                    except Exception:
                        continue
                
                if not recaptcha_found:
                    log("No reCAPTCHA found - proceeding with login")
                    
            except Exception as e:
                log(f"reCAPTCHA check failed (non-critical): {e}")

            # Try to submit the form by pressing Enter or clicking a login button.
            try:
                # Look for submit button with common labels
                login_button_selectors = [
                    "button:has-text('Sign in')",
                    "button:has-text('Log in')",
                    "button:has-text('Login')",
                    "button:has-text('Submit')",
                    "button[type='submit']",
                    "input[type='submit']",
                ]
                submitted = False
                for sel in login_button_selectors:
                    try:
                        btn = page.locator(sel)
                        if await btn.count():
                            log(f"Found login button with selector: {sel}")
                            await btn.first.click()
                            submitted = True
                            break
                    except Exception:
                        continue
                
                if not submitted:
                    # Press Enter in the password field as fallback
                    log("No login button found; pressing Enter in password field.")
                    await password_input.press("Enter")
            except Exception as e:
                log(f"Error submitting login form: {e}")
                return False
            
            # Optionally wait for navigation or a specific element that indicates login success.
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            return True
        except Exception as e:
            log(f"Username/password login attempt failed: {e}")
            return False
    
    async def _try_registration(self, page: Page) -> bool:
        """Attempt to register a new account if login fails.
        
        Looks for sign-up/register links or buttons and attempts to create
        an account using the same email and password credentials.
        """
        try:
            import asyncio
            
            log("Looking for registration/signup option...")
            
            # Try to find registration link or button
            register_patterns = [
                "Sign up",
                "sign up",
                "Sign Up",
                "Register",
                "register",
                "Create account",
                "Create Account",
                "Get started",
                "Get Started",
                "Join",
                "join",
            ]
            
            register_element = None
            for pattern in register_patterns:
                try:
                    # Try as button first
                    btn = page.get_by_role("button", name=pattern)
                    if await btn.count() > 0:
                        register_element = btn.first
                        log(f"Found register button: {pattern}")
                        break
                    
                    # Try as link
                    link = page.get_by_role("link", name=pattern)
                    if await link.count() > 0:
                        register_element = link.first
                        log(f"Found register link: {pattern}")
                        break
                except Exception:
                    pass
            
            if not register_element:
                log("Could not find registration link/button")
                return False
            
            # Click registration element
            await register_element.click()
            await asyncio.sleep(2)
            
            # Check if there's a Google signup option
            try:
                buttons = page.get_by_role("button")
                count = await buttons.count()
                for i in range(count):
                    btn = buttons.nth(i)
                    try:
                        text = (await btn.inner_text()).lower()
                    except Exception:
                        text = ""
                    if "google" in text and ("sign up" in text or "continue" in text or "register" in text):
                        log("Found Google registration button; using OAuth")
                        return await self._try_google_oauth(page)
                    elif "google" in text:
                        log("Found Google button; using OAuth")
                        return await self._try_google_oauth(page)
            except Exception:
                pass
            
            # Try traditional registration form
            return await self._fill_registration_form(page)
            
        except Exception as e:
            log(f"Registration attempt failed: {e}")
            return False
    
    async def _fill_registration_form(self, page: Page) -> bool:
        """Fill out a traditional registration form."""
        try:
            import asyncio

            # Find email input
            email_selectors = [
                "input[type='email']",
                "input[name='email']",
                "input[placeholder*='email' i]",
                "input[aria-label*='email' i]",
            ]

            email_input = None
            for sel in email_selectors:
                loc = page.locator(sel)
                if await loc.count():
                    email_input = loc.first
                    break

            if not email_input:
                log("Could not find email input in registration form")
                return False

            await email_input.fill(self.email)
            await asyncio.sleep(0.5)

            # Find password input(s)
            password_selectors = [
                "input[type='password']",
                "input[name='password']",
                "input[placeholder*='password' i]",
            ]

            password_inputs = []
            for sel in password_selectors:
                locs = await page.locator(sel).all()
                password_inputs.extend(locs)

            if not password_inputs:
                log("Could not find password input in registration form")
                return False

            # Fill all password fields (handles password + confirm password)
            for pwd_input in password_inputs:
                await pwd_input.fill(self.password)
                await asyncio.sleep(0.3)

            log(f"Filled {len(password_inputs)} password field(s)")

            # Check for reCAPTCHA checkbox and click it if present
            try:
                log("Checking for reCAPTCHA 'I'm not a robot' checkbox...")
                recaptcha_selectors = [
                    "iframe[src*='recaptcha']",
                    "iframe[title*='reCAPTCHA']",
                    ".g-recaptcha",
                ]
                
                recaptcha_found = False
                for selector in recaptcha_selectors:
                    try:
                        recaptcha_element = page.locator(selector)
                        if await recaptcha_element.count() > 0:
                            recaptcha_found = True
                            log(f"Found reCAPTCHA element: {selector}")
                            
                            # If it's an iframe, we need to click inside it
                            if "iframe" in selector:
                                # Find the checkbox inside the iframe
                                frames = page.frames
                                for frame in frames:
                                    try:
                                        # Look for the recaptcha checkbox
                                        checkbox = frame.locator(".recaptcha-checkbox-border, #recaptcha-anchor, .recaptcha-checkbox")
                                        if await checkbox.count() > 0:
                                            log("Clicking reCAPTCHA checkbox in iframe...")
                                            await checkbox.first.click()
                                            log("✓ Successfully clicked reCAPTCHA checkbox")
                                            await asyncio.sleep(2)  # Wait for validation
                                            break
                                    except Exception:
                                        continue
                            else:
                                # Try to click the element directly
                                await recaptcha_element.first.click()
                                log("✓ Clicked reCAPTCHA element")
                                await asyncio.sleep(2)
                            break
                    except Exception:
                        continue
                
                if not recaptcha_found:
                    log("No reCAPTCHA found - proceeding with registration")
                    
            except Exception as e:
                log(f"reCAPTCHA check failed (non-critical): {e}")

            # Try to submit
            try:
                # Look for submit button
                submit_patterns = ["Sign up", "Register", "Create account", "Continue", "Get started", "Join"]
                for pattern in submit_patterns:
                    btn = page.get_by_role("button", name=pattern)
                    if await btn.count() > 0:
                        await btn.first.click()
                        log(f"Clicked submit button: {pattern}")
                        await asyncio.sleep(3)
                        return True

                # Fallback: press Enter
                await page.keyboard.press("Enter")
                await asyncio.sleep(3)
                return True
            except Exception as e:
                log(f"Failed to submit registration form: {e}")
                return False

        except Exception as e:
            log(f"Failed to fill registration form: {e}")
            return False

    async def _save_storage_state(self, page: Page) -> None:
        """Persist authentication state to disk.

        If `self.storage_state_path` is defined, this method calls
        `page.context.storage_state()` and writes the result to the file.
        """
        try:
            if not self.storage_state_path:
                return
            context = page.context
            state = await context.storage_state()
            Path(self.storage_state_path).parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_state_path, "w", encoding="utf-8") as f:
                import json

                json.dump(state, f)
            log(f"Saved storage state to {self.storage_state_path}")
        except Exception as e:
            log(f"Failed to save storage state: {e}")