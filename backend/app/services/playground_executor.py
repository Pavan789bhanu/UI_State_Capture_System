"""
Playground execution service for running workflows in sandbox mode
"""
import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from playwright.async_api import async_playwright, Browser, Page, TimeoutError as PlaywrightTimeout
import logging

logger = logging.getLogger(__name__)


class PlaygroundExecutor:
    """Execute workflows in playground mode with real-time feedback"""
    
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.playwright = None
        
    async def initialize(self, headless: bool = False):
        """Initialize browser for execution"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
        
        if not self.browser:
            self.browser = await self.playwright.chromium.launch(headless=headless)
            
        context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        self.page = await context.new_page()
        
    async def cleanup(self):
        """Close browser and cleanup"""
        if self.page:
            await self.page.close()
            self.page = None
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
            
    async def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a single workflow step
        
        Returns execution result with status, screenshot, and metadata
        """
        if not self.page:
            await self.initialize()
            
        step_type = step.get('type')
        result = {
            'step_type': step_type,
            'status': 'success',
            'message': '',
            'screenshot': None,
            'duration_ms': 0,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        start_time = datetime.now()
        
        try:
            if step_type == 'navigate':
                await self._execute_navigate(step)
                result['message'] = f"Navigated to {step.get('url')}"
                
            elif step_type == 'click':
                await self._execute_click(step)
                result['message'] = f"Clicked element: {step.get('selector')}"
                
            elif step_type == 'type':
                await self._execute_type(step)
                result['message'] = f"Typed '{step.get('value')}' into {step.get('selector')}"
                
            elif step_type == 'wait':
                await self._execute_wait(step)
                selector = step.get('selector')
                timeout = step.get('timeout', 15000)
                if selector:
                    result['message'] = f"Successfully waited for element '{selector}' ({timeout}ms)"
                else:
                    result['message'] = f"Waited for {timeout}ms"
                
            elif step_type == 'select':
                await self._execute_select(step)
                result['message'] = f"Selected '{step.get('value')}' in {step.get('selector')}"
                
            elif step_type == 'extract':
                extracted_data = await self._execute_extract(step)
                result['message'] = f"Extracted {len(extracted_data)} elements"
                result['data'] = extracted_data
                
            elif step_type == 'screenshot':
                screenshot = await self.page.screenshot(type='png')
                result['screenshot'] = screenshot
                result['message'] = "Screenshot captured"
                
            else:
                result['status'] = 'error'
                result['message'] = f"Unknown step type: {step_type}"
                
            # Capture screenshot after successful step
            if result['status'] == 'success' and step_type != 'screenshot':
                result['screenshot'] = await self.page.screenshot(type='png', full_page=False)
                
        except PlaywrightTimeout as e:
            result['status'] = 'error'
            result['message'] = f"Timeout: {str(e)}"
            logger.error(f"Timeout executing step {step_type}: {e}")
            
        except Exception as e:
            result['status'] = 'error'
            result['message'] = f"Error: {str(e)}"
            logger.error(f"Error executing step {step_type}: {e}")
            
        finally:
            duration = (datetime.now() - start_time).total_seconds() * 1000
            result['duration_ms'] = int(duration)
            
        return result
    
    async def _execute_navigate(self, step: Dict[str, Any]):
        """Navigate to URL"""
        url = step.get('url')
        if not url:
            raise ValueError("URL is required for navigate action")
        
        await self.page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait a bit for any dynamic content or popups
        await asyncio.sleep(1)
        
        # Try to handle common cookie/consent popups
        await self._handle_common_popups()
        
    async def _handle_common_popups(self):
        """Attempt to close common popups like cookie consent"""
        try:
            # Amazon cookie consent (various regions)
            amazon_selectors = [
                '#sp-cc-accept',  # Amazon US
                'input[aria-labelledby="sp-cc-accept"]',
                'button:has-text("Accept")',
                '#a-autoid-0-announce',  # Amazon cookie dialog
            ]
            
            for selector in amazon_selectors:
                try:
                    element = await self.page.wait_for_selector(selector, timeout=2000, state='visible')
                    if element:
                        await element.click()
                        await asyncio.sleep(0.5)
                        logger.info(f"Closed popup using selector: {selector}")
                        return
                except:
                    continue
                    
            # Generic cookie consent buttons
            generic_selectors = [
                'button:has-text("Accept")',
                'button:has-text("I agree")',
                'button:has-text("OK")',
                '[aria-label*="Accept"]',
                '[aria-label*="Agree"]',
            ]
            
            for selector in generic_selectors:
                try:
                    element = await self.page.wait_for_selector(selector, timeout=1000, state='visible')
                    if element:
                        await element.click()
                        await asyncio.sleep(0.5)
                        logger.info(f"Closed generic popup using selector: {selector}")
                        return
                except:
                    continue
                    
        except Exception as e:
            # Don't fail if popup handling fails
            logger.debug(f"Popup handling attempt: {e}")
        
    def _sanitize_selector(self, selector: str) -> str:
        """Sanitize selector by fixing common invalid CSS patterns"""
        import re
        
        # Fix :first -> :first-child
        selector = re.sub(r':first\b(?!\-)', ':first-child', selector)
        
        # Fix :last -> :last-child
        selector = re.sub(r':last\b(?!\-)', ':last-child', selector)
        
        # Remove :contains() - not valid CSS (jQuery syntax)
        selector = re.sub(r':contains\([^)]+\)', '', selector)
        
        # Fix invalid pseudo-classes
        selector = selector.replace(':eq(', ':nth-child(')
        
        return selector.strip()
    
    async def _execute_click(self, step: Dict[str, Any]):
        """Click element with smart selector fallback strategies"""
        selector = step.get('selector')
        if not selector:
            raise ValueError("Selector is required for click action")
        
        # Sanitize selector to fix common invalid patterns
        selector = self._sanitize_selector(selector)
        
        # Strategy 1: Try CSS selector with increased timeout
        try:
            # Wait for element to be visible and clickable
            await self.page.wait_for_selector(selector, state='visible', timeout=10000)
            await self.page.click(selector, timeout=10000)
            return
        except Exception as css_error:
            logger.debug(f"CSS selector failed: {css_error}")
        
        # Strategy 2: Try XPath if selector looks like XPath
        if selector.startswith('//') or selector.startswith('('):
            try:
                await self.page.click(f'xpath={selector}', timeout=10000)
                return
            except Exception as xpath_error:
                logger.debug(f"XPath selector failed: {xpath_error}")
        
        # Strategy 3: Try text-based selector
        try:
            # Try exact text match
            await self.page.click(f'text={selector}', timeout=10000)
            return
        except Exception:
            # Try partial text match
            try:
                await self.page.click(f'text=/{selector}/i', timeout=10000)
                return
            except Exception as text_error:
                logger.debug(f"Text selector failed: {text_error}")
        
        # Strategy 4: Try role-based selector for common elements
        try:
            # Extract likely button/link text from selector
            text = selector.strip('button:has-text()').strip('\'\"')
            await self.page.get_by_role('button', name=text).click(timeout=10000)
            return
        except Exception as role_error:
            logger.debug(f"Role selector failed: {role_error}")
        
        # Strategy 5: Try aria-label
        try:
            await self.page.click(f'[aria-label*="{selector}"]', timeout=10000)
            return
        except Exception as aria_error:
            logger.debug(f"Aria-label selector failed: {aria_error}")
        
        # If all strategies fail, raise the most informative error
        raise PlaywrightTimeout(
            f"Timeout: Could not find clickable element with selector '{selector}'. "
            f"Tried CSS, XPath, text, role, and aria-label strategies. "
            f"Please verify the element exists and is visible on the page."
        )
                
    async def _execute_type(self, step: Dict[str, Any]):
        """Type text into element"""
        selector = step.get('selector')
        value = step.get('value', '')
        
        if not selector:
            raise ValueError("Selector is required for type action")
        
        # Sanitize selector to fix common invalid patterns
        selector = self._sanitize_selector(selector)
        
        # Clear existing content first
        await self.page.fill(selector, '', timeout=5000)
        # Type new content
        await self.page.fill(selector, value, timeout=5000)
        
    async def _execute_wait(self, step: Dict[str, Any]):
        """Wait for time or element"""
        selector = step.get('selector')
        timeout = step.get('timeout', 15000)  # Increased default to 15 seconds
        state = step.get('state', 'visible')  # Default to waiting for visible state
        
        if selector:
            # Wait for element with specified state (visible, attached, hidden)
            try:
                await self.page.wait_for_selector(selector, state=state, timeout=timeout)
            except PlaywrightTimeout:
                # Provide helpful error with suggestions
                url = self.page.url
                suggestions = []
                
                # Amazon-specific suggestions
                if 'amazon.' in url:
                    suggestions = [
                        "Amazon search box selector: #twotabsearchtextbox",
                        "Try waiting for page load: await page.wait_for_load_state('networkidle')",
                        "Check for cookie consent popup that may be blocking elements",
                        "Increase timeout to 20000ms or more for slow loading"
                    ]
                else:
                    suggestions = [
                        f"Element not found with selector: {selector}",
                        f"Waited {timeout}ms for element to be {state}",
                        "Try increasing timeout or checking if selector is correct",
                        "Use browser dev tools to inspect the element"
                    ]
                
                error_msg = f"Timeout waiting for selector '{selector}' to be {state}. Suggestions:\n" + "\n".join(f"  - {s}" for s in suggestions)
                raise PlaywrightTimeout(error_msg)
        else:
            # Wait for time
            await asyncio.sleep(timeout / 1000)
            
    async def _execute_select(self, step: Dict[str, Any]):
        """Select option from dropdown"""
        selector = step.get('selector')
        value = step.get('value')
        
        if not selector or not value:
            raise ValueError("Selector and value are required for select action")
        
        await self.page.select_option(selector, value, timeout=5000)
        
    async def _execute_extract(self, step: Dict[str, Any]) -> List[str]:
        """Extract data from elements"""
        selector = step.get('selector')
        
        if not selector:
            raise ValueError("Selector is required for extract action")
        
        # Get all matching elements
        elements = await self.page.query_selector_all(selector)
        
        # Extract text content
        data = []
        for element in elements:
            text = await element.text_content()
            if text:
                data.append(text.strip())
                
        return data
    
    async def validate_selector(self, selector: str) -> Dict[str, Any]:
        """
        Validate if a selector exists on current page
        
        Returns count and preview of matching elements
        """
        if not self.page:
            return {'valid': False, 'message': 'Browser not initialized'}
        
        try:
            elements = await self.page.query_selector_all(selector)
            count = len(elements)
            
            # Get preview of first few elements
            previews = []
            for element in elements[:3]:
                tag = await element.evaluate('el => el.tagName')
                text = await element.text_content()
                previews.append({
                    'tag': tag.lower(),
                    'text': text[:50] if text else ''
                })
            
            return {
                'valid': count > 0,
                'count': count,
                'previews': previews,
                'message': f'Found {count} element(s)'
            }
            
        except Exception as e:
            return {
                'valid': False,
                'count': 0,
                'message': f'Invalid selector: {str(e)}'
            }
    
    async def get_page_state(self) -> Dict[str, Any]:
        """Get current page state for debugging"""
        if not self.page:
            return {'url': None, 'title': None}
        
        return {
            'url': self.page.url,
            'title': await self.page.title(),
            'viewport': self.page.viewport_size
        }


# Global executor instance
playground_executor = PlaygroundExecutor()
