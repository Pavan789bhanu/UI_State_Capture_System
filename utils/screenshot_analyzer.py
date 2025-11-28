"""Screenshot analysis and narrative generation.

This module handles post-execution analysis of captured screenshots:
- Deduplication using perceptual hashing
- Narrative generation with LLM-based screenshot descriptions
- HTML report creation with annotated screenshots
"""

from __future__ import annotations

import asyncio
import base64
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from openai import AsyncOpenAI
from PIL import Image
import imagehash

from config import (
    OPENAI_API_KEY,
    LLM_MODEL,
    SCREENSHOT_DEDUPLICATION_ENABLED,
    SCREENSHOT_DEDUPLICATION_THRESHOLD,
    SCREENSHOT_DELETE_DUPLICATES
)
from utils.logger import log


class ScreenshotAnalyzer:
    """Analyze screenshots and generate execution narratives."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.client = AsyncOpenAI(api_key=api_key or OPENAI_API_KEY)
        self.model = model or LLM_MODEL

    def deduplicate_screenshots(self, screenshot_paths: List[str], threshold: int = None, remove_duplicates: bool = None) -> List[str]:
        """Remove duplicate screenshots using perceptual hashing.
        
        Args:
            screenshot_paths: List of screenshot file paths
            threshold: Hash difference threshold (default from config: {SCREENSHOT_DEDUPLICATION_THRESHOLD} bits)
                - 0-5 bits: Nearly identical (minor UI changes only)
                - 6-10 bits: Very similar (small content changes)
                - 11-15 bits: Similar (noticeable differences)
                - 16-25 bits: Moderately similar
                - 26+ bits: Different (significant changes)
            remove_duplicates: If True, delete duplicate files from disk (default from config: {SCREENSHOT_DELETE_DUPLICATES})
            
        Returns:
            List of unique screenshot paths (duplicates kept on disk but excluded from report unless delete enabled)
        """
        # Use config defaults if not specified
        if threshold is None:
            threshold = SCREENSHOT_DEDUPLICATION_THRESHOLD
        if remove_duplicates is None:
            remove_duplicates = SCREENSHOT_DELETE_DUPLICATES
        
        if not screenshot_paths:
            return []
        
        unique_screenshots = []
        seen_hashes = []
        duplicates_removed = 0
        
        for path in screenshot_paths:
            try:
                img = Image.open(path)
                img_hash = imagehash.phash(img)
                
                # Check if similar to any seen hash
                is_duplicate = False
                for seen_hash in seen_hashes:
                    if abs(img_hash - seen_hash) <= threshold:
                        is_duplicate = True
                        log(f"✗ DUPLICATE: {Path(path).name}")
                        if remove_duplicates:
                            try:
                                Path(path).unlink()
                                duplicates_removed += 1
                                log(f"  Deleted from disk")
                            except Exception as e:
                                log(f"  Warning: Could not delete {Path(path).name}: {e}")
                        else:
                            log(f"  Kept on disk (delete disabled)")
                        break
                
                if not is_duplicate:
                    unique_screenshots.append(path)
                    seen_hashes.append(img_hash)
                    log(f"✓ UNIQUE: {Path(path).name}")
                else:
                    # Duplicate found - log with hash difference for debugging
                    min_diff = min([abs(img_hash - seen_hash) for seen_hash in seen_hashes])
                    log(f"  Hash difference: {min_diff} bits (threshold: {threshold})")
            except Exception as e:
                log(f"ERROR: Error processing {path}: {e}")
                # Keep it if we can't analyze
                unique_screenshots.append(path)
        
        if remove_duplicates:
            log(f"Deduplication complete: {len(screenshot_paths)} total → {len(unique_screenshots)} unique ({duplicates_removed} duplicates deleted)")
        else:
            log(f"Deduplication complete: {len(screenshot_paths)} total → {len(unique_screenshots)} unique ({len(screenshot_paths) - len(unique_screenshots)} duplicates kept on disk)")
        return unique_screenshots

    async def describe_screenshot(self, screenshot_path: str, context: Dict[str, Any]) -> str:
        """Generate natural language description of a screenshot.
        
        Args:
            screenshot_path: Path to screenshot
            context: Context dict with step info, action, URL, etc.
            
        Returns:
            Natural language description
        """
        try:
            with open(screenshot_path, "rb") as img_file:
                img_base64 = base64.b64encode(img_file.read()).decode("utf-8")
            
            step_num = context.get("step", "?")
            action = context.get("action", {})
            url = context.get("url", "")
            description = context.get("description", "")
            
            prompt = f"""Analyze this screenshot from step {step_num} of a UI automation task.

Context:
- Step description: {description}
- Action taken: {action.get('type', 'N/A')} on "{action.get('target_text', 'N/A')}"
- URL: {url}

Provide a brief 2-3 sentence description of:
1. What is visible on the screen
2. What action was taken or what state the page is in
3. What will happen next or what to expect

Be specific and reference visible UI elements (buttons, forms, text, etc.)."""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a technical writer creating step-by-step documentation. Be concise and specific."},
                    {"role": "user", "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}}
                    ]}
                ],
                max_tokens=200,
            )
            
            return response.choices[0].message.content or "Unable to describe screenshot."
        except Exception as e:
            log(f"Error describing screenshot: {e}")
            return f"Step {step_num}: {description}"

    async def generate_narrative(
        self,
        dataset: List[Dict[str, Any]],
        task: str,
        run_dir: Path,
    ) -> str:
        """Generate full execution narrative with screenshots.
        
        Args:
            dataset: Execution dataset with steps
            task: Original task description
            run_dir: Directory containing screenshots
            
        Returns:
            Path to generated HTML report
        """
        log("Generating execution narrative...")
        
        # Collect all screenshots
        screenshot_steps = [d for d in dataset if d.get("screenshot_path")]
        screenshot_paths = [d["screenshot_path"] for d in screenshot_steps]
        
        # Deduplicate based on config settings
        if SCREENSHOT_DEDUPLICATION_ENABLED:
            log(f"Deduplication enabled: threshold={SCREENSHOT_DEDUPLICATION_THRESHOLD} bits, delete={SCREENSHOT_DELETE_DUPLICATES}")
            unique_paths = self.deduplicate_screenshots(screenshot_paths)
        else:
            log("Deduplication disabled - including all screenshots")
            unique_paths = screenshot_paths
        
        # Filter dataset to only include steps with unique screenshots that still exist
        unique_paths_set = set(unique_paths)
        unique_steps = [s for s in screenshot_steps if s["screenshot_path"] in unique_paths_set and Path(s["screenshot_path"]).exists()]
        
        # Generate descriptions for each screenshot
        descriptions = []
        for idx, step_data in enumerate(unique_steps, 1):
            desc = await self.describe_screenshot(
                step_data["screenshot_path"],
                {
                    "step": step_data.get("step"),
                    "description": step_data.get("ui_state_description", step_data.get("description", "")),
                    "action": step_data.get("action", {}),
                    "url": step_data.get("url", ""),
                }
            )
            descriptions.append({
                "step": idx,  # Use sequential numbering
                "screenshot": Path(step_data["screenshot_path"]).name,
                "description": desc,
                "url": step_data.get("url", ""),
                "action": step_data.get("action", {}),
                "step_description": step_data.get("description", ""),
            })
        
        # Generate transition explanations between screenshots
        transitions = []
        for i in range(len(descriptions) - 1):
            current_step = descriptions[i]
            next_step = descriptions[i + 1]
            
            # CRITICAL: current_step contains the action taken AFTER its screenshot
            # which leads to next_step's screenshot. This is the transition action.
            transition = await self._generate_transition_explanation(
                current_step, next_step, i + 1, i + 2
            )
            transitions.append(transition)
        
        # Generate HTML report
        html_content = self._generate_html_report(task, descriptions, transitions, run_dir)
        report_path = run_dir / "execution_report.html"
        report_path.write_text(html_content, encoding="utf-8")
        
        # Also generate markdown
        md_content = self._generate_markdown_report(task, descriptions, transitions)
        md_path = run_dir / "execution_report.md"
        md_path.write_text(md_content, encoding="utf-8")
        
        log(f"SUCCESS: Narrative reports generated: {report_path}")
        return str(report_path)

    async def _generate_transition_explanation(
        self,
        current_step: Dict[str, Any],
        next_step: Dict[str, Any],
        step_num: int,
        next_step_num: int,
    ) -> str:
        """Generate explanation of what happened between two screenshots.
        
        The action stored in current_step is what was taken AFTER taking
        the current screenshot, which led to the next screenshot.
        
        Args:
            current_step: Current step data with screenshot and action taken after it
            next_step: Next step data
            step_num: Current step number
            next_step_num: Next step number
            
        Returns:
            Transition explanation text
        """
        try:
            # CRITICAL: current_step's action is what happened AFTER screenshot 1
            # to produce screenshot 2. NOT next_step's action!
            action = current_step.get("action", {})
            action_type = action.get("type", "unknown")
            target_text = action.get("target_text", "")
            selector = action.get("selector", "")
            value = action.get("value", "")
            step_desc = current_step.get("step_description", "")
            
            # Build action description
            if action_type == "click":
                if target_text:
                    action_desc = f"clicked on '{target_text}'"
                elif selector:
                    action_desc = f"clicked element matching selector '{selector}'"
                else:
                    action_desc = "performed a click action"
            elif action_type == "type":
                if value:
                    action_desc = f"typed '{value}' into a field"
                else:
                    action_desc = "entered text into a field"
            elif action_type == "navigate":
                action_desc = f"navigated to a new page"
            elif action_type == "scroll":
                action_desc = "scrolled the page"
            elif action_type == "keyboard":
                action_desc = f"pressed key: {value or 'Enter'}"
            else:
                action_desc = f"performed action: {action_type}"
            
            # Get URL change info
            current_url = current_step.get("url", "")
            next_url = next_step.get("url", "")
            url_changed = current_url != next_url
            
            # Use LLM to generate concise transition explanation
            prompt = f"""Generate a concise 1-2 sentence explanation of what happened between these two steps in a UI automation:

**From Step {step_num} to Step {next_step_num}:**
- Action taken: {action_desc}
- Step goal: {step_desc}
- URL changed: {url_changed}
- Previous URL: {current_url[:80]}...
- New URL: {next_url[:80]}...

Explain what action was taken and what changed as a result. Be specific and brief. Focus on user-visible changes."""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a technical writer. Create brief, specific transition descriptions for UI automation steps."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
            )
            
            return response.choices[0].message.content or f"Action: {action_desc}"
        
        except Exception as e:
            log(f"Error generating transition explanation: {e}")
            # Fallback to simple description
            action = next_step.get("action", {})
            action_type = action.get("type", "action")
            target = action.get("target_text") or action.get("selector") or ""
            return f"Performed {action_type}" + (f" on '{target}'" if target else "")

    def _generate_html_report(self, task: str, steps: List[Dict], transitions: List[str], run_dir: Path) -> str:
        """Generate HTML report with screenshots and descriptions."""
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Automation Report: {task}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}
        h1 {{
            margin: 0 0 10px 0;
            font-size: 36px;
            font-weight: 600;
        }}
        .task {{
            font-size: 20px;
            opacity: 0.95;
            margin: 15px 0;
        }}
        .info-box {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }}
        .info-box h2 {{
            margin-top: 0;
            color: #667eea;
            font-size: 24px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        .info-box p {{
            line-height: 1.8;
            color: #555;
            margin: 10px 0;
        }}
        .info-box ul {{
            line-height: 1.8;
            color: #555;
        }}
        .agent-badge {{
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 8px;
        }}
        .agent-badge.planner {{
            background: #2196F3;
        }}
        .agent-badge.vision {{
            background: #FF9800;
        }}
        .step {{
            background: white;
            padding: 35px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .step:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }}
        .step-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        .step-number {{
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 8px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
        }}
        .url {{
            color: #666;
            font-size: 13px;
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            padding: 6px 12px;
            border-radius: 6px;
            word-break: break-all;
            max-width: 60%;
        }}
        .screenshot-container {{
            position: relative;
            margin: 25px 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }}
        .screenshot {{
            width: 100%;
            display: block;
            border: 1px solid #e0e0e0;
        }}
        .description {{
            line-height: 1.8;
            color: #333;
            font-size: 16px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-top: 20px;
        }}
        .transition {{
            background: linear-gradient(to right, #fff5e6, #ffffff);
            border-left: 5px solid #FF9800;
            padding: 25px;
            margin: 25px 0;
            border-radius: 8px;
            font-size: 15px;
            color: #555;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }}
        .transition::before {{
            content: "🤖 AI Agent Action";
            display: block;
            font-weight: bold;
            font-style: normal;
            color: #FF9800;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .footer {{
            text-align: center;
            padding: 30px;
            color: #999;
            font-size: 14px;
            border-top: 1px solid #ddd;
            margin-top: 40px;
        }}
        .stats {{
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 20px;
        }}
        .stat-item {{
            flex: 1;
            min-width: 200px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }}
        .stat-number {{
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        .stat-label {{
            font-size: 14px;
            opacity: 0.9;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Automation Execution Report</h1>
        <p class="task"><strong>Task:</strong> {task}</p>
        <div class="stats">
            <div class="stat-item">
                <div class="stat-number">{len(steps)}</div>
                <div class="stat-label">Steps Captured</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">{len(transitions)}</div>
                <div class="stat-label">AI Actions</div>
            </div>
        </div>
    </div>
    
    <div class="info-box">
        <h2>🧠 How This Automation Works</h2>
        <p>This report shows the step-by-step execution of an AI-powered browser automation system. Two AI agents work together to complete your task:</p>
        <ul>
            <li><strong>Planner Agent <span class="agent-badge planner">GPT-4</span></strong> - Creates a strategic plan by breaking down your task into logical steps (navigate, login, interact, verify).</li>
            <li><strong>Vision Agent <span class="agent-badge vision">GPT-4 Vision</span></strong> - Analyzes screenshots in real-time to decide which buttons to click, forms to fill, and actions to take.</li>
        </ul>
        <p><strong>The Process:</strong> The Planner creates the initial roadmap, then the Vision Agent looks at each screenshot and decides the best action to move forward. If the plan doesn't work perfectly, the Vision Agent adapts and explores alternative paths to complete your task.</p>
    </div>
"""
        
        for i, step in enumerate(steps):
            # Determine which agent was involved
            action = step.get('action', {})
            action_type = action.get('type', '')
            agent_info = ""
            if action_type:
                agent_info = '<span class="agent-badge vision">Vision Agent Decision</span>'
            
            html += f"""
    <div class="step">
        <div class="step-header">
            <span class="step-number">Step {i + 1}</span>
            {agent_info}
            <span class="url">{step.get('url', '')[:80]}...</span>
        </div>
        <div class="screenshot-container">
            <img src="{step['screenshot']}" alt="Step {i + 1}" class="screenshot">
        </div>
        <div class="description">
            <strong>What the AI sees:</strong> {step['description']}
        </div>
    </div>
"""
            # Add transition explanation between steps (except after last step)
            if i < len(transitions):
                html += f"""
    <div class="transition">
        {transitions[i]}
    </div>
"""
        
        html += """
    <div class="footer">
        <p><strong>Generated by UI Capture System</strong></p>
        <p>Powered by OpenAI GPT-4 Vision and Playwright Browser Automation</p>
    </div>
</body>
</html>
"""
        return html

    def _generate_markdown_report(self, task: str, steps: List[Dict], transitions: List[str]) -> str:
        """Generate Markdown report."""
        md = f"""# Execution Report

**Task:** {task}

**Total Steps:** {len(steps)} unique screenshots (all captured images preserved in run folder)

---

"""
        for i, step in enumerate(steps):
            md += f"""## Step {i + 1}

![Step {i + 1}]({step['screenshot']})

**URL:** `{step.get('url', '')}`

{step['description']}

"""
            # Add transition explanation between steps
            if i < len(transitions):
                md += f"""**➜ Action Taken:**  
_{transitions[i]}_

"""
            
            md += "---\n\n"
        
        return md
