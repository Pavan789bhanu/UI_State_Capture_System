"""Loop detection for workflow execution.

Detects repetitive patterns and stuck states during workflow automation
to prevent infinite loops and wasted resources.
"""

from typing import List, Tuple


class LoopDetector:
    """Detect repetitive action patterns in workflow execution."""

    def __init__(self, window_size: int = 6) -> None:
        """Initialize loop detector.
        
        Args:
            window_size: Number of recent actions to analyze for patterns.
        """
        self.window_size = window_size

    def detect_loop(self, action_history: List[dict]) -> Tuple[bool, str]:
        """Detect if workflow is in a repetitive loop.
        
        Analyzes recent action history for patterns indicating the workflow
        is stuck or repeating actions without progress.
        
        Args:
            action_history: List of action dictionaries with keys:
                - type: Action type (click, fill, etc.)
                - target_text: Text of the target element
                - selector: CSS selector used
                - url: Current page URL
                - page_changed: Whether page changed after action
        
        Returns:
            Tuple of (is_loop, reason):
                - is_loop: True if loop detected
                - reason: Human-readable explanation of the detected pattern
        """
        if len(action_history) < self.window_size:
            return False, ""
        
        recent = action_history[-self.window_size:]
        
        # Check 0: Same action on same URL with no page change (most common loop)
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
        action_signatures = [
            f"{a.get('type')}:{a.get('target_text','')}:{a.get('selector','')}" 
            for a in recent
        ]
        unique_actions = len(set(action_signatures))
        if unique_actions <= 2:
            return True, f"Action repetition: only {unique_actions} unique actions in last {self.window_size} steps"
        
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
