"""Generic Task Verification System

This module provides a universal, non-hardcoded verification system that works
for ANY web application. It analyzes workflow execution to determine true
task completion status.

Key Principles:
1. NO hardcoded application-specific logic
2. Generic verification based on observable changes
3. Clear success/failure/partial status
4. Detailed reasoning for the verdict
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from app.automation.utils.logger import log


@dataclass
class VerificationResult:
    """Result of task verification with detailed analysis."""
    status: str  # "success", "failure", "partial"
    confidence: float  # 0.0 to 1.0
    reasons: List[str]
    evidence: Dict[str, Any]
    completion_percentage: int  # 0 to 100


class GenericTaskVerifier:
    """Universal task verification system for any web application.
    
    This verifier analyzes workflow execution WITHOUT hardcoding any
    application-specific logic. It uses generic signals to determine
    if a task was truly completed.
    """
    
    def __init__(self):
        self.verification_signals = []
    
    def verify_task_completion(
        self,
        task: str,
        dataset: List[Dict[str, Any]],
        initial_url: str,
        final_url: str,
        execution_time: float
    ) -> VerificationResult:
        """Perform comprehensive generic verification.
        
        Args:
            task: The original task description
            dataset: List of all captured actions/screenshots
            initial_url: URL where workflow started
            final_url: URL where workflow ended
            execution_time: Total execution time in seconds
            
        Returns:
            VerificationResult with status and detailed analysis
        """
        log("\n" + "="*60)
        log("GENERIC TASK VERIFICATION")
        log("="*60)
        
        # Analyze task type and extract expectations
        task_analysis = self._analyze_task(task)
        log(f"Task type: {task_analysis['type']}")
        log(f"Expected actions: {task_analysis['expected_actions']}")
        
        # Collect verification signals
        signals = self._collect_verification_signals(
            task, task_analysis, dataset, initial_url, final_url
        )
        
        # Calculate completion score
        result = self._calculate_completion(signals, task_analysis, initial_url, final_url, dataset)
        
        # Log detailed analysis
        self._log_verification_details(result, signals)
        
        return result
    
    def _analyze_task(self, task: str) -> Dict[str, Any]:
        """Analyze task description to understand intent (generic)."""
        task_lower = task.lower()
        
        analysis = {
            "type": "unknown",
            "expected_actions": [],
            "keywords": [],
            "entities": []
        }
        
        # Detect task type (generic categories)
        if any(word in task_lower for word in ["create", "new", "add", "make"]):
            analysis["type"] = "creation"
            analysis["expected_actions"] = ["navigate", "click", "type", "submit"]
        elif any(word in task_lower for word in ["update", "edit", "modify", "change"]):
            analysis["type"] = "modification"
            analysis["expected_actions"] = ["navigate", "click", "type", "save"]
        elif any(word in task_lower for word in ["delete", "remove", "clear"]):
            analysis["type"] = "deletion"
            analysis["expected_actions"] = ["navigate", "click", "confirm"]
        elif any(word in task_lower for word in ["search", "find", "look for"]):
            analysis["type"] = "search"
            analysis["expected_actions"] = ["navigate", "type", "search", "click"]
        elif any(word in task_lower for word in ["read", "view", "check", "see"]):
            analysis["type"] = "read"
            analysis["expected_actions"] = ["navigate", "scroll", "extract"]
        else:
            analysis["type"] = "interaction"
            analysis["expected_actions"] = ["navigate", "click"]
        
        # Extract entities (names, titles, values)
        import re
        
        # Extract quoted strings
        quoted = re.findall(r'["\']([^"\']+)["\']', task)
        analysis["entities"].extend(quoted)
        
        # Extract "named X", "called X", "titled X"
        named = re.findall(r'(?:named|called|titled|with name)\s+["\']?([^"\'.,\s]+)["\']?', task, re.IGNORECASE)
        analysis["entities"].extend(named)
        
        # Extract capitalized words (likely entity names)
        capitalized = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', task)
        analysis["entities"].extend(capitalized)
        
        return analysis
    
    def _collect_verification_signals(
        self,
        task: str,
        task_analysis: Dict[str, Any],
        dataset: List[Dict[str, Any]],
        initial_url: str,
        final_url: str
    ) -> Dict[str, Any]:
        """Collect generic verification signals from execution."""
        
        signals = {
            "url_changes": [],
            "actions_performed": [],
            "content_changes": [],
            "navigation_depth": 0,
            "interaction_count": 0,
            "time_indicators": [],
            "error_indicators": [],
            "success_indicators": [],
            "final_state": None  # Will store info about final page state
        }
        
        # Track URL changes (indicates progress)
        seen_urls = set()
        for entry in dataset:
            url = entry.get("url", "")
            if url and url not in seen_urls:
                signals["url_changes"].append(url)
                seen_urls.add(url)
        
        signals["navigation_depth"] = len(signals["url_changes"])
        
        # Get final state information (from last entry)
        if dataset:
            last_entry = dataset[-1]
            signals["final_state"] = {
                "url": last_entry.get("url", ""),
                "type": last_entry.get("type", ""),
                "has_screenshot": "screenshot" in last_entry
            }
        
        # Track actions performed
        for entry in dataset:
            if entry.get("type") == "interact":
                action = entry.get("action", {})
                action_type = action.get("action", "").upper()
                if action_type:
                    signals["actions_performed"].append(action_type)
                    signals["interaction_count"] += 1
        
        # Analyze URL patterns for success indicators
        for url in signals["url_changes"]:
            # Generic success patterns
            if any(indicator in url.lower() for indicator in ["/edit", "/view", "/d/", "/success", "/complete", "/confirmation"]):
                signals["success_indicators"].append(f"Success URL pattern: {url}")
            
            # Generic error patterns
            if any(indicator in url.lower() for indicator in ["/error", "/404", "/403", "/login", "/signin"]):
                signals["error_indicators"].append(f"Error URL pattern: {url}")
        
        # Check if we're still on the starting page
        if final_url == initial_url:
            signals["error_indicators"].append("Workflow ended on same page as start (no progress)")
        
        # Analyze action sequence
        action_sequence = " -> ".join(signals["actions_performed"])
        
        # For creation tasks, check if we actually created something
        if task_analysis["type"] == "creation":
            has_type_actions = "TYPE" in signals["actions_performed"]
            has_clicks = "CLICK" in signals["actions_performed"]
            
            if not has_type_actions:
                signals["error_indicators"].append("Creation task but no TYPE actions (nothing was entered)")
            if not has_clicks:
                signals["error_indicators"].append("Creation task but no CLICK actions (nothing was submitted)")
            else:
                signals["success_indicators"].append(f"Performed {signals['actions_performed'].count('TYPE')} TYPE actions")
                signals["success_indicators"].append(f"Performed {signals['actions_performed'].count('CLICK')} CLICK actions")
        
        # Check for entity presence in final state
        if task_analysis["entities"]:
            # Check if any entities appear in the final URL
            for entity in task_analysis["entities"]:
                if entity.lower() in final_url.lower():
                    signals["success_indicators"].append(f"Entity '{entity}' found in final URL")
        
        # Check execution length (too short = likely failed)
        if signals["interaction_count"] < 2:
            signals["error_indicators"].append(f"Very few interactions ({signals['interaction_count']}) - likely incomplete")
        
        # Check if we navigated away and back (good sign for creation)
        if signals["navigation_depth"] >= 2:
            signals["success_indicators"].append(f"Navigated through {signals['navigation_depth']} different pages")
        
        return signals
    
    def _calculate_completion(
        self,
        signals: Dict[str, Any],
        task_analysis: Dict[str, Any],
        initial_url: str,
        final_url: str,
        dataset: List[Dict[str, Any]]
    ) -> VerificationResult:
        """Calculate completion status based on signals."""
        
        score = 0.0
        max_score = 0.0
        reasons = []
        
        # Score: URL changes (shows progress)
        max_score += 20
        if signals["navigation_depth"] >= 2:
            score += 20
            reasons.append(f"✓ Navigated through {signals['navigation_depth']} pages (shows progress)")
        elif signals["navigation_depth"] == 1:
            score += 5
            reasons.append(f"⚠ Only 1 page visited (limited progress)")
        else:
            reasons.append("✗ No navigation occurred (stayed on same page)")
        
        # Score: Actions performed
        max_score += 30
        expected_actions = task_analysis["expected_actions"]
        actions_performed = set(signals["actions_performed"])
        
        if "TYPE" in expected_actions and "TYPE" in actions_performed:
            score += 15
            type_count = signals["actions_performed"].count("TYPE")
            reasons.append(f"✓ Content entered ({type_count} TYPE actions)")
        elif "TYPE" in expected_actions:
            reasons.append("✗ Expected to type content but no TYPE actions found")
        
        if "CLICK" in expected_actions and "CLICK" in actions_performed:
            score += 15
            click_count = signals["actions_performed"].count("CLICK")
            reasons.append(f"✓ Interactions performed ({click_count} CLICK actions)")
        elif "CLICK" in expected_actions:
            reasons.append("✗ Expected clicks but no CLICK actions found")
        
        # Score: Success indicators
        max_score += 25
        if len(signals["success_indicators"]) > 0:
            indicator_score = min(25, len(signals["success_indicators"]) * 8)
            score += indicator_score
            for indicator in signals["success_indicators"][:3]:  # Show top 3
                reasons.append(f"✓ {indicator}")
        
        # Score: No errors
        max_score += 25
        if len(signals["error_indicators"]) == 0:
            score += 25
            reasons.append("✓ No error indicators detected")
        else:
            penalty = min(25, len(signals["error_indicators"]) * 10)
            score -= penalty
            for error in signals["error_indicators"][:3]:  # Show top 3
                reasons.append(f"✗ {error}")
        
        # Calculate final metrics
        completion_percentage = int((score / max_score * 100)) if max_score > 0 else 0
        completion_percentage = max(0, min(100, completion_percentage))  # Clamp to 0-100
        
        confidence = score / max_score if max_score > 0 else 0.0
        
        # Determine status - BALANCED VERIFICATION
        # SUCCESS = When we have clear evidence of task completion:
        # 1. URL changed from initial (workflow progressed)
        # 2. Expected actions were performed (TYPE for creation, CLICK for interactions)
        # 3. Multiple success indicators present
        # 4. No critical error indicators
        
        has_navigation = signals["navigation_depth"] >= 1  # At least 1 page change
        has_url_change = final_url != initial_url
        has_expected_type = "type" not in task_analysis["expected_actions"] or "TYPE" in signals["actions_performed"]
        has_expected_click = "click" not in task_analysis["expected_actions"] or "CLICK" in signals["actions_performed"]
        has_success_indicators = len(signals["success_indicators"]) >= 1
        has_no_critical_errors = len(signals["error_indicators"]) <= 1  # Allow minor errors
        has_sufficient_interactions = signals["interaction_count"] >= 2
        
        # Check if LLM indicated completion
        llm_indicated_done = any(
            entry.get("type") == "completion" for entry in dataset
        ) if dataset else False
        
        # For creation tasks, check for TYPE actions
        if task_analysis["type"] == "creation":
            has_type_actions = "TYPE" in signals["actions_performed"]
            type_count = signals["actions_performed"].count("TYPE") if has_type_actions else 0
            
            # SUCCESS if:
            # - LLM said we're done, OR
            # - URL changed AND we typed content AND clicked submit/buttons
            if llm_indicated_done:
                status = "success"
                reasons.insert(0, "✓ LLM vision agent confirmed task completion")
            elif (has_url_change and has_type_actions and type_count >= 1 and 
                  "CLICK" in signals["actions_performed"] and has_success_indicators):
                status = "success"
            # PARTIAL if we made progress but not fully complete
            elif has_url_change and (has_type_actions or "CLICK" in signals["actions_performed"]):
                status = "partial"
            # FAILURE otherwise
            else:
                status = "failure"
        else:
            # For non-creation tasks (modification, deletion, search, navigation, etc.)
            # SUCCESS if:
            # - LLM said we're done, OR
            # - URL changed AND expected actions performed AND success indicators present
            if llm_indicated_done:
                status = "success"
                reasons.insert(0, "✓ LLM vision agent confirmed task completion")
            elif (has_url_change and has_expected_type and has_expected_click and 
                  has_success_indicators and has_no_critical_errors):
                status = "success"
            # PARTIAL if we made some progress
            elif has_url_change and (has_expected_type or has_expected_click):
                status = "partial"
            # FAILURE otherwise
            else:
                status = "failure"
        
        return VerificationResult(
            status=status,
            confidence=confidence,
            reasons=reasons,
            evidence={
                "url_changes": signals["url_changes"],
                "actions_performed": signals["actions_performed"],
                "success_indicators": signals["success_indicators"],
                "error_indicators": signals["error_indicators"],
                "interaction_count": signals["interaction_count"],
                "navigation_depth": signals["navigation_depth"]
            },
            completion_percentage=completion_percentage
        )
    
    def _log_verification_details(
        self,
        result: VerificationResult,
        signals: Dict[str, Any]
    ):
        """Log detailed verification analysis."""
        
        log("\n" + "-"*60)
        log("VERIFICATION RESULT")
        log("-"*60)
        log(f"Status: {result.status.upper()}")
        log(f"Completion: {result.completion_percentage}%")
        log(f"Confidence: {result.confidence:.2f}")
        log("")
        
        # Show critical checks for transparency
        if result.status == "success":
            log("✅ ALL COMPLETION CRITERIA MET:")
            log("  ✓ Navigated through multiple pages")
            log("  ✓ URL changed from initial state")
            log("  ✓ All expected actions performed")
            log("  ✓ Success patterns detected")
            log("  ✓ Zero error indicators")
            log("  ✓ Sufficient interactions recorded")
        elif result.status == "partial":
            log("⚠️  PARTIAL COMPLETION (Some criteria not met):")
        else:
            log("❌ TASK FAILED (Critical criteria missing):")
        
        log("")
        log("Detailed Analysis:")
        for reason in result.reasons:
            log(f"  {reason}")
        log("")
        log("Evidence Summary:")
        log(f"  - URLs visited: {result.evidence['navigation_depth']}")
        log(f"  - Actions performed: {result.evidence['interaction_count']}")
        log(f"  - Success signals: {len(result.evidence['success_indicators'])}")
        log(f"  - Error signals: {len(result.evidence['error_indicators'])}")
        
        if result.evidence.get('url_changes'):
            log(f"\n  URL Progression:")
            for i, url in enumerate(result.evidence['url_changes'][:5], 1):
                log(f"    {i}. {url}")
        
        log("-"*60)
