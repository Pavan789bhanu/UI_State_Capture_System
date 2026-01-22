"""Task completion checker for workflow execution.

Evaluates whether a workflow task has been completed based on page state,
URL patterns, and content analysis.
"""

from typing import List, Tuple
from playwright.async_api import Page


class CompletionChecker:
    """Evaluate task completion state during workflow execution."""

    async def evaluate_completion(
        self, 
        page: Page, 
        task: str, 
        app_name: str
    ) -> Tuple[bool, bool, List[str]]:
        """Evaluate whether task is complete using strict verification.
        
        Analyzes page content, URL, and visible text to determine if the
        specified task has been completed successfully.
        
        Args:
            page: Playwright page object
            task: Natural language task description
            app_name: Application name for context
        
        Returns:
            Tuple of (completed, partial_progress, reasons):
                - completed: True if task fully completed
                - partial_progress: True if some progress detected
                - reasons: List of human-readable evaluation details
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
