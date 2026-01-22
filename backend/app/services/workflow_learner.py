"""Workflow Learning System - Learn from successes and failures to improve future executions.

This service maintains a knowledge base of workflow patterns, common failures,
and successful recovery strategies. It learns from each execution and provides
contextual guidance to agents based on historical performance.

Key Features:
- Learn successful action sequences for different websites
- Identify common failure patterns and their solutions
- Provide contextual hints to VisionAgent based on past experiences
- Improve over time through reinforcement from user feedback
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

from app.automation.utils.logger import log
from app.core.config import settings


class WorkflowLearner:
    """Learn from workflow executions to improve future performance.
    
    This class maintains a persistent knowledge base that grows over time:
    1. Successful patterns: What actions worked for specific goals on specific sites
    2. Failure patterns: What actions consistently fail and why
    3. Recovery strategies: How to recover from common error states
    4. Site-specific quirks: Special handling needed for particular websites
    
    The learner is consulted before each action to provide context and after
    each execution to record outcomes.
    """
    
    def __init__(self):
        """Initialize the workflow learner with persistent storage."""
        self.knowledge_base_path = Path(settings.SCREENSHOT_DIR) / "workflow_knowledge.json"
        self.knowledge_base = self._load_knowledge_base()
        
        # In-memory tracking for current execution
        self.current_execution = None
    
    def _load_knowledge_base(self) -> Dict[str, Any]:
        """Load the persistent knowledge base from disk."""
        if self.knowledge_base_path.exists():
            try:
                with open(self.knowledge_base_path, 'r') as f:
                    kb = json.load(f)
                    log(f"Loaded workflow knowledge base with {len(kb.get('patterns', {}))} learned patterns")
                    return kb
            except Exception as e:
                log(f"Error loading knowledge base: {e}")
        
        # Initialize empty knowledge base
        return {
            "patterns": {},  # Successful action sequences per site/goal
            "failures": {},  # Common failure patterns
            "recovery_strategies": {},  # How to recover from failures
            "site_quirks": {},  # Special handling per domain
            "statistics": {
                "total_executions": 0,
                "successful_executions": 0,
                "failed_executions": 0,
                "total_actions": 0,
                "failed_actions": 0,
            },
            "version": "1.0",
            "last_updated": time.time(),
        }
    
    def _save_knowledge_base(self):
        """Persist the knowledge base to disk."""
        try:
            self.knowledge_base["last_updated"] = time.time()
            self.knowledge_base_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.knowledge_base_path, 'w') as f:
                json.dump(self.knowledge_base, f, indent=2)
            
            log(f"Saved workflow knowledge base to {self.knowledge_base_path}")
        except Exception as e:
            log(f"Error saving knowledge base: {e}")
    
    def start_execution(self, task: str, app_name: str, start_url: str) -> str:
        """Start tracking a new workflow execution.
        
        Args:
            task: The task description
            app_name: The application name (e.g., "Google Docs")
            start_url: The starting URL
        
        Returns:
            Execution ID for tracking
        """
        execution_id = f"exec_{int(time.time())}_{hash(task) % 10000}"
        
        self.current_execution = {
            "id": execution_id,
            "task": task,
            "app_name": app_name,
            "start_url": start_url,
            "domain": self._extract_domain(start_url),
            "started_at": time.time(),
            "actions": [],
            "failures": [],
            "recoveries": [],
            "completed": False,
        }
        
        log(f"Started tracking execution: {execution_id}")
        return execution_id
    
    def record_action(self, action: Dict[str, Any], success: bool, 
                     url_before: str, url_after: str, observation: Optional[str] = None):
        """Record an action taken during execution.
        
        Args:
            action: The action dict from VisionAgent
            success: Whether the action succeeded (changed state)
            url_before: URL before the action
            url_after: URL after the action
            observation: Optional observation about what happened
        """
        if not self.current_execution:
            return
        
        action_record = {
            "type": action.get("type"),
            "target_text": action.get("target_text"),
            "selector": action.get("selector"),
            "value": action.get("value", "")[:100] if action.get("value") else None,  # Truncate long values
            "success": success,
            "url_before": url_before,
            "url_after": url_after,
            "url_changed": url_before != url_after,
            "observation": observation,
            "timestamp": time.time(),
        }
        
        self.current_execution["actions"].append(action_record)
        
        # Track failures
        if not success:
            self.current_execution["failures"].append({
                "action": action_record,
                "context": {
                    "url": url_before,
                    "previous_actions": len(self.current_execution["actions"]),
                }
            })
        
        # Update statistics
        self.knowledge_base["statistics"]["total_actions"] += 1
        if not success:
            self.knowledge_base["statistics"]["failed_actions"] += 1
    
    def record_recovery(self, failure_action: Dict[str, Any], recovery_action: Dict[str, Any], 
                       success: bool):
        """Record a recovery attempt from a failed action.
        
        Args:
            failure_action: The action that failed
            recovery_action: The action taken to recover
            success: Whether the recovery succeeded
        """
        if not self.current_execution:
            return
        
        self.current_execution["recoveries"].append({
            "failed_action": failure_action,
            "recovery_action": recovery_action,
            "success": success,
            "timestamp": time.time(),
        })
    
    def complete_execution(self, success: bool, completion_status: str, 
                          verification_results: Optional[Dict] = None):
        """Complete the current execution and learn from it.
        
        Args:
            success: Whether the workflow completed successfully
            completion_status: "completed", "partial", or "incomplete"
            verification_results: Results from verification step
        """
        if not self.current_execution:
            return
        
        self.current_execution["completed"] = success
        self.current_execution["completion_status"] = completion_status
        self.current_execution["verification_results"] = verification_results
        self.current_execution["ended_at"] = time.time()
        self.current_execution["duration"] = (
            self.current_execution["ended_at"] - self.current_execution["started_at"]
        )
        
        # Update statistics
        self.knowledge_base["statistics"]["total_executions"] += 1
        if success:
            self.knowledge_base["statistics"]["successful_executions"] += 1
        else:
            self.knowledge_base["statistics"]["failed_executions"] += 1
        
        # Learn from this execution
        self._learn_from_execution(self.current_execution)
        
        # Save to disk
        self._save_knowledge_base()
        
        log(f"Completed execution {self.current_execution['id']}: {completion_status}")
        self.current_execution = None
    
    def _learn_from_execution(self, execution: Dict[str, Any]):
        """Extract learnings from a completed execution.
        
        This method identifies:
        1. Successful action patterns worth remembering
        2. Failure patterns to avoid
        3. Recovery strategies that worked
        4. Site-specific quirks discovered
        """
        domain = execution["domain"]
        task_category = self._categorize_task(execution["task"])
        
        # Create pattern key: domain + task_category
        pattern_key = f"{domain}:{task_category}"
        
        if execution["completed"]:
            # Learn successful pattern
            self._learn_successful_pattern(pattern_key, execution)
        else:
            # Learn failure pattern
            self._learn_failure_pattern(pattern_key, execution)
        
        # Learn from recoveries (both successful and failed)
        for recovery in execution.get("recoveries", []):
            self._learn_recovery_strategy(domain, recovery)
        
        # Learn site-specific quirks
        self._learn_site_quirks(domain, execution)
    
    def _learn_successful_pattern(self, pattern_key: str, execution: Dict[str, Any]):
        """Record a successful action sequence for future reference."""
        if pattern_key not in self.knowledge_base["patterns"]:
            self.knowledge_base["patterns"][pattern_key] = {
                "task_examples": [],
                "successful_sequences": [],
                "success_count": 0,
                "average_duration": 0,
                "key_actions": [],
            }
        
        pattern = self.knowledge_base["patterns"][pattern_key]
        
        # Add this task as an example
        if len(pattern["task_examples"]) < 5:  # Keep top 5 examples
            pattern["task_examples"].append(execution["task"])
        
        # Record the successful action sequence
        action_sequence = [
            {
                "type": a["type"],
                "target": a.get("target_text", "")[:50],
                "url_changed": a["url_changed"],
            }
            for a in execution["actions"]
            if a["success"]  # Only successful actions
        ]
        
        pattern["successful_sequences"].append({
            "actions": action_sequence,
            "duration": execution["duration"],
            "timestamp": execution["ended_at"],
        })
        
        # Keep only most recent 10 sequences
        if len(pattern["successful_sequences"]) > 10:
            pattern["successful_sequences"] = pattern["successful_sequences"][-10:]
        
        # Update statistics
        pattern["success_count"] += 1
        pattern["average_duration"] = sum(
            s["duration"] for s in pattern["successful_sequences"]
        ) / len(pattern["successful_sequences"])
        
        # Identify key actions (actions that appear in most successful sequences)
        self._identify_key_actions(pattern)
        
        log(f"Learned successful pattern for {pattern_key} (total successes: {pattern['success_count']})")
    
    def _learn_failure_pattern(self, pattern_key: str, execution: Dict[str, Any]):
        """Record failure patterns to avoid repeating mistakes."""
        if pattern_key not in self.knowledge_base["failures"]:
            self.knowledge_base["failures"][pattern_key] = {
                "common_failures": [],
                "failure_count": 0,
            }
        
        failure_info = self.knowledge_base["failures"][pattern_key]
        
        # Identify repeated failed actions
        failed_actions = [f["action"] for f in execution["failures"] if f.get("action") is not None]
        
        for failed_action in failed_actions:
            # Skip if failed_action is None or doesn't have required fields
            if not failed_action or not isinstance(failed_action, dict) or "type" not in failed_action:
                continue
                
            # Check if this failure pattern already exists
            found = False
            for existing in failure_info["common_failures"]:
                if (existing["type"] == failed_action["type"] and 
                    existing.get("target_text") == failed_action.get("target_text")):
                    existing["count"] += 1
                    found = True
                    break
            
            if not found:
                failure_info["common_failures"].append({
                    "type": failed_action["type"],
                    "target_text": failed_action.get("target_text", "")[:50] if failed_action.get("target_text") else "",
                    "selector": failed_action.get("selector", "")[:100] if failed_action.get("selector") else "",
                    "url_context": failed_action.get("url_before", ""),
                    "count": 1,
                    "advice": f"Action '{failed_action['type']}' on '{failed_action.get('target_text', 'unknown')}' failed. Try alternative selector or different element.",
                })
        
        failure_info["failure_count"] += 1
        
        # Keep only top 20 most common failures
        failure_info["common_failures"].sort(key=lambda x: x["count"], reverse=True)
        failure_info["common_failures"] = failure_info["common_failures"][:20]
        
        log(f"Learned failure patterns for {pattern_key} (total failures: {failure_info['failure_count']})")
    
    def _learn_recovery_strategy(self, domain: str, recovery: Dict[str, Any]):
        """Record successful recovery strategies."""
        if not recovery["success"]:
            return  # Only learn from successful recoveries
        
        if domain not in self.knowledge_base["recovery_strategies"]:
            self.knowledge_base["recovery_strategies"][domain] = []
        
        strategies = self.knowledge_base["recovery_strategies"][domain]
        
        strategy = {
            "failed_action_type": recovery["failed_action"]["type"],
            "recovery_action_type": recovery["recovery_action"]["type"],
            "recovery_target": recovery["recovery_action"].get("target_text", "")[:50],
            "success_count": 1,
        }
        
        # Check if similar strategy exists
        found = False
        for existing in strategies:
            if (existing["failed_action_type"] == strategy["failed_action_type"] and
                existing["recovery_action_type"] == strategy["recovery_action_type"]):
                existing["success_count"] += 1
                found = True
                break
        
        if not found:
            strategies.append(strategy)
        
        # Keep top 10 strategies per domain
        strategies.sort(key=lambda x: x["success_count"], reverse=True)
        self.knowledge_base["recovery_strategies"][domain] = strategies[:10]
    
    def _learn_site_quirks(self, domain: str, execution: Dict[str, Any]):
        """Learn site-specific behavior patterns."""
        if domain not in self.knowledge_base["site_quirks"]:
            self.knowledge_base["site_quirks"][domain] = {
                "navigation_delay": 0,
                "requires_long_waits": False,
                "has_overlays": False,
                "keyboard_shortcuts": [],
            }
        
        quirks = self.knowledge_base["site_quirks"][domain]
        
        # Detect if site needs longer waits (many actions with no URL change)
        no_change_actions = sum(1 for a in execution["actions"] if not a["url_changed"])
        if no_change_actions > len(execution["actions"]) * 0.6:  # >60% actions don't change URL
            quirks["requires_long_waits"] = True
        
        # Detect typical navigation delay
        url_change_actions = [a for a in execution["actions"] if a["url_changed"]]
        if url_change_actions:
            # Estimate time between action and URL change
            quirks["navigation_delay"] = 3  # Default assumption for now
    
    def get_contextual_guidance(self, goal: str, current_url: str, 
                                previous_actions: List[str]) -> Dict[str, Any]:
        """Get contextual guidance based on learned patterns.
        
        Args:
            goal: Current goal/task description
            current_url: Current page URL
            previous_actions: Actions taken so far in this execution
        
        Returns:
            Dictionary with guidance including:
            - successful_patterns: Known working approaches
            - common_failures: Failures to avoid
            - recovery_suggestions: How to recover if stuck
            - site_quirks: Special handling for this domain
        """
        domain = self._extract_domain(current_url)
        task_category = self._categorize_task(goal)
        pattern_key = f"{domain}:{task_category}"
        
        guidance = {
            "has_learned_pattern": False,
            "successful_patterns": [],
            "common_failures": [],
            "recovery_suggestions": [],
            "site_quirks": {},
        }
        
        # Get successful patterns
        if pattern_key in self.knowledge_base["patterns"]:
            pattern = self.knowledge_base["patterns"][pattern_key]
            guidance["has_learned_pattern"] = True
            guidance["successful_patterns"] = pattern.get("key_actions", [])
            
            log(f"Found learned pattern for {pattern_key} with {pattern['success_count']} successes")
        
        # Get common failures to avoid
        if pattern_key in self.knowledge_base["failures"]:
            failures = self.knowledge_base["failures"][pattern_key]
            guidance["common_failures"] = failures.get("common_failures", [])[:5]  # Top 5
        
        # Get recovery strategies
        if domain in self.knowledge_base["recovery_strategies"]:
            guidance["recovery_suggestions"] = self.knowledge_base["recovery_strategies"][domain][:3]
        
        # Get site quirks
        if domain in self.knowledge_base["site_quirks"]:
            guidance["site_quirks"] = self.knowledge_base["site_quirks"][domain]
        
        return guidance
    
    def _identify_key_actions(self, pattern: Dict[str, Any]):
        """Identify actions that appear in most successful sequences."""
        action_counts = defaultdict(int)
        
        for sequence in pattern["successful_sequences"]:
            for action in sequence["actions"]:
                key = f"{action['type']}:{action['target']}"
                action_counts[key] += 1
        
        # Get actions that appear in >50% of sequences
        threshold = len(pattern["successful_sequences"]) * 0.5
        key_actions = [
            {
                "type": key.split(":")[0],
                "target": key.split(":", 1)[1],
                "frequency": count / len(pattern["successful_sequences"]),
            }
            for key, count in action_counts.items()
            if count >= threshold
        ]
        
        pattern["key_actions"] = sorted(key_actions, key=lambda x: x["frequency"], reverse=True)
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc
    
    def _categorize_task(self, task: str) -> str:
        """Categorize task into broad categories."""
        task_lower = task.lower()
        
        if any(verb in task_lower for verb in ["create", "add", "new", "make"]):
            if "document" in task_lower or "doc" in task_lower:
                return "document_creation"
            elif "project" in task_lower:
                return "project_creation"
            elif "issue" in task_lower or "task" in task_lower or "ticket" in task_lower:
                return "issue_creation"
            else:
                return "creation"
        
        elif any(verb in task_lower for verb in ["edit", "update", "modify", "change"]):
            return "editing"
        
        elif any(verb in task_lower for verb in ["delete", "remove"]):
            return "deletion"
        
        elif any(verb in task_lower for verb in ["search", "find", "filter"]):
            return "search"
        
        elif any(verb in task_lower for verb in ["buy", "purchase", "order"]):
            return "purchase"
        
        else:
            return "general"
    
    def format_guidance_for_prompt(self, guidance: Dict[str, Any]) -> str:
        """Format guidance as text for inclusion in agent prompt."""
        if not guidance["has_learned_pattern"] and not guidance["common_failures"]:
            return ""
        
        prompt_parts = ["**LEARNED PATTERNS FROM PREVIOUS EXECUTIONS:**\n"]
        
        # Successful patterns
        if guidance["successful_patterns"]:
            prompt_parts.append("✓ Known successful actions for similar tasks:")
            for action in guidance["successful_patterns"][:5]:
                prompt_parts.append(
                    f"  - {action['type']} on '{action['target']}' "
                    f"(success rate: {action['frequency']*100:.0f}%)"
                )
            prompt_parts.append("")
        
        # Failures to avoid
        if guidance["common_failures"]:
            prompt_parts.append("⚠ Common failures to AVOID:")
            for failure in guidance["common_failures"][:3]:
                prompt_parts.append(
                    f"  - {failure['type']} on '{failure['target_text']}' failed {failure['count']} times"
                )
                prompt_parts.append(f"    Advice: {failure['advice']}")
            prompt_parts.append("")
        
        # Recovery suggestions
        if guidance["recovery_suggestions"]:
            prompt_parts.append("🔄 Recovery strategies if action fails:")
            for strategy in guidance["recovery_suggestions"][:2]:
                prompt_parts.append(
                    f"  - If {strategy['failed_action_type']} fails, try {strategy['recovery_action_type']} "
                    f"(worked {strategy['success_count']} times)"
                )
            prompt_parts.append("")
        
        # Site quirks
        if guidance["site_quirks"]:
            quirks = guidance["site_quirks"]
            if quirks.get("requires_long_waits"):
                prompt_parts.append("⏱ Site quirk: This site requires longer waits between actions")
            if quirks.get("has_overlays"):
                prompt_parts.append("⚠ Site quirk: This site often shows overlays that need to be closed")
        
        return "\n".join(prompt_parts)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get learning statistics."""
        stats = self.knowledge_base["statistics"].copy()
        stats["learned_patterns"] = len(self.knowledge_base["patterns"])
        stats["known_failures"] = len(self.knowledge_base["failures"])
        stats["recovery_strategies"] = sum(
            len(strategies) for strategies in self.knowledge_base["recovery_strategies"].values()
        )
        stats["known_domains"] = len(self.knowledge_base["site_quirks"])
        
        if stats["total_executions"] > 0:
            stats["success_rate"] = (
                stats["successful_executions"] / stats["total_executions"]
            ) * 100
            stats["action_success_rate"] = (
                (stats["total_actions"] - stats["failed_actions"]) / stats["total_actions"]
            ) * 100 if stats["total_actions"] > 0 else 0
        
        return stats


    def record_user_correction(
        self,
        task: str,
        domain: str,
        generated_steps: List[Dict[str, Any]],
        corrected_steps: List[Dict[str, Any]],
        feedback_type: str,
        notes: Optional[str] = None
    ):
        """Record user corrections to AI-generated workflows for learning.
        
        Args:
            task: Original task description
            domain: Website domain (e.g., 'amazon.com')
            generated_steps: Steps generated by AI
            corrected_steps: Steps corrected by user
            feedback_type: Type of feedback ('correction', 'success', 'failure')
            notes: Optional user notes about the correction
        """
        # Initialize corrections storage if not exists
        if "user_corrections" not in self.knowledge_base:
            self.knowledge_base["user_corrections"] = {}
        
        if domain not in self.knowledge_base["user_corrections"]:
            self.knowledge_base["user_corrections"][domain] = []
        
        # Analyze differences between generated and corrected steps
        corrections = []
        for i, (gen_step, corr_step) in enumerate(zip(generated_steps, corrected_steps)):
            if gen_step != corr_step:
                corrections.append({
                    "step_index": i,
                    "generated": gen_step,
                    "corrected": corr_step,
                    "correction_type": self._identify_correction_type(gen_step, corr_step)
                })
        
        # Handle added or removed steps
        if len(corrected_steps) > len(generated_steps):
            for i in range(len(generated_steps), len(corrected_steps)):
                corrections.append({
                    "step_index": i,
                    "generated": None,
                    "corrected": corrected_steps[i],
                    "correction_type": "added_step"
                })
        elif len(corrected_steps) < len(generated_steps):
            for i in range(len(corrected_steps), len(generated_steps)):
                corrections.append({
                    "step_index": i,
                    "generated": generated_steps[i],
                    "corrected": None,
                    "correction_type": "removed_step"
                })
        
        # Record the correction
        correction_record = {
            "task": task,
            "timestamp": time.time(),
            "feedback_type": feedback_type,
            "corrections": corrections,
            "notes": notes,
            "domain": domain
        }
        
        self.knowledge_base["user_corrections"][domain].append(correction_record)
        
        # Update patterns based on corrections
        self._learn_from_corrections(domain, task, corrections)
        
        # Update statistics
        if "user_feedback_count" not in self.knowledge_base["statistics"]:
            self.knowledge_base["statistics"]["user_feedback_count"] = 0
        self.knowledge_base["statistics"]["user_feedback_count"] += 1
        
        self._save_knowledge_base()
        
        log(f"Recorded user correction for {domain}: {len(corrections)} changes")
    
    def _identify_correction_type(self, gen_step: Dict, corr_step: Dict) -> str:
        """Identify what type of correction was made."""
        if gen_step.get("type") != corr_step.get("type"):
            return "changed_action_type"
        elif gen_step.get("selector") != corr_step.get("selector"):
            return "corrected_selector"
        elif gen_step.get("value") != corr_step.get("value"):
            return "corrected_value"
        elif gen_step.get("url") != corr_step.get("url"):
            return "corrected_url"
        elif gen_step.get("timeout") != corr_step.get("timeout"):
            return "adjusted_timeout"
        else:
            return "other_modification"
    
    def _learn_from_corrections(self, domain: str, task: str, corrections: List[Dict]):
        """Extract learnings from user corrections."""
        # Initialize learned corrections if not exists
        if "learned_corrections" not in self.knowledge_base:
            self.knowledge_base["learned_corrections"] = {}
        
        if domain not in self.knowledge_base["learned_corrections"]:
            self.knowledge_base["learned_corrections"][domain] = {
                "selector_corrections": {},
                "timeout_adjustments": {},
                "common_additions": [],
                "common_removals": []
            }
        
        learned = self.knowledge_base["learned_corrections"][domain]
        
        for correction in corrections:
            correction_type = correction["correction_type"]
            
            # Learn selector corrections
            if correction_type == "corrected_selector":
                gen_selector = correction["generated"].get("selector")
                corr_selector = correction["corrected"].get("selector")
                action_type = correction["corrected"].get("type")
                
                key = f"{action_type}:{gen_selector}"
                if key not in learned["selector_corrections"]:
                    learned["selector_corrections"][key] = {
                        "incorrect": gen_selector,
                        "correct": corr_selector,
                        "action_type": action_type,
                        "frequency": 0
                    }
                learned["selector_corrections"][key]["frequency"] += 1
            
            # Learn timeout adjustments
            elif correction_type == "adjusted_timeout":
                gen_timeout = correction["generated"].get("timeout", 5000)
                corr_timeout = correction["corrected"].get("timeout", 5000)
                action_type = correction["corrected"].get("type")
                
                key = f"{action_type}"
                if key not in learned["timeout_adjustments"]:
                    learned["timeout_adjustments"][key] = {
                        "default_too_short": corr_timeout > gen_timeout,
                        "recommended_timeout": corr_timeout,
                        "frequency": 0
                    }
                learned["timeout_adjustments"][key]["frequency"] += 1
                learned["timeout_adjustments"][key]["recommended_timeout"] = (
                    learned["timeout_adjustments"][key]["recommended_timeout"] + corr_timeout
                ) // 2  # Average
            
            # Learn commonly added steps
            elif correction_type == "added_step":
                step = correction["corrected"]
                learned["common_additions"].append({
                    "step": step,
                    "task_context": task,
                    "timestamp": time.time()
                })
            
            # Learn commonly removed steps
            elif correction_type == "removed_step":
                step = correction["generated"]
                learned["common_removals"].append({
                    "step": step,
                    "task_context": task,
                    "timestamp": time.time()
                })
    
    def get_suggestions_for_task(self, task: str, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get learned suggestions that may apply to this task.
        
        Args:
            task: Task description
            domain: Optional domain to get domain-specific suggestions
            
        Returns:
            List of suggestions based on past user corrections
        """
        suggestions = []
        
        if "learned_corrections" not in self.knowledge_base:
            return suggestions
        
        # Get domain-specific suggestions if domain provided
        if domain and domain in self.knowledge_base["learned_corrections"]:
            learned = self.knowledge_base["learned_corrections"][domain]
            
            # Suggest corrected selectors
            for key, correction in learned["selector_corrections"].items():
                if correction["frequency"] >= 2:  # Only suggest if seen multiple times
                    suggestions.append({
                        "type": "selector_correction",
                        "action_type": correction["action_type"],
                        "message": f"For {correction['action_type']} actions, use selector '{correction['correct']}' instead of '{correction['incorrect']}'",
                        "priority": "high",
                        "frequency": correction["frequency"]
                    })
            
            # Suggest timeout adjustments
            for action_type, adjustment in learned["timeout_adjustments"].items():
                if adjustment["frequency"] >= 2:
                    suggestions.append({
                        "type": "timeout_adjustment",
                        "action_type": action_type,
                        "message": f"For {action_type} actions on {domain}, use timeout of {adjustment['recommended_timeout']}ms",
                        "priority": "medium",
                        "frequency": adjustment["frequency"]
                    })
            
            # Suggest commonly added steps
            if learned["common_additions"]:
                recent_additions = sorted(
                    learned["common_additions"],
                    key=lambda x: x["timestamp"],
                    reverse=True
                )[:3]
                
                for addition in recent_additions:
                    suggestions.append({
                        "type": "missing_step",
                        "message": f"Users often add this step: {addition['step'].get('type')} - {addition['step'].get('description', '')}",
                        "step": addition["step"],
                        "priority": "medium"
                    })
        
        # Get general suggestions from all domains
        if "learned_corrections" in self.knowledge_base:
            all_domains = self.knowledge_base["learned_corrections"]
            
            # Find common patterns across all domains
            all_selector_corrections = {}
            for domain_data in all_domains.values():
                for key, correction in domain_data["selector_corrections"].items():
                    if key not in all_selector_corrections:
                        all_selector_corrections[key] = 0
                    all_selector_corrections[key] += correction["frequency"]
            
            # Suggest very common corrections
            for key, frequency in all_selector_corrections.items():
                if frequency >= 5:  # Seen across multiple domains/tasks
                    action_type = key.split(":")[0]
                    suggestions.append({
                        "type": "common_pattern",
                        "message": f"Common pattern: Check selector for {action_type} actions (corrected {frequency} times across sites)",
                        "priority": "low"
                    })
        
        return suggestions
    
    def get_improvement_summary(self, domain: str) -> Dict[str, Any]:
        """Get a summary of improvements learned for a domain.
        
        Args:
            domain: Website domain
            
        Returns:
            Summary of learned improvements
        """
        if "learned_corrections" not in self.knowledge_base or domain not in self.knowledge_base["learned_corrections"]:
            return {
                "has_improvements": False,
                "message": "No learned improvements yet for this domain"
            }
        
        learned = self.knowledge_base["learned_corrections"][domain]
        
        return {
            "has_improvements": True,
            "selector_corrections": len(learned["selector_corrections"]),
            "timeout_optimizations": len(learned["timeout_adjustments"]),
            "step_additions_learned": len(learned["common_additions"]),
            "unnecessary_steps_identified": len(learned["common_removals"]),
            "message": f"Learned {len(learned['selector_corrections'])} selector improvements and {len(learned['timeout_adjustments'])} timeout optimizations"
        }
