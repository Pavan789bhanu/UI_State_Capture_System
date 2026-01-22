"""Vision‑driven planning agent.

`VisionAgent` leverages an LLM (such as OpenAI's GPT models) to plan
the next action in a UI workflow. It takes the current screenshot,
extracted DOM elements and the high level goal as input and returns
a structured JSON describing the recommended action.

This design decouples perception from planning. The agent does not
directly interact with the browser; instead it merely decides what
should happen next. See `workflow_engine.py` for execution logic.

ENHANCED WITH VIDEO LEARNING:
The VisionAgent now learns from demonstration videos to understand:
- Step-by-step workflow patterns
- How to structure comprehensive reports
- What success criteria to track
- How to write meaningful ending notes
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from pathlib import Path

from openai import AsyncOpenAI

from app.core.config import settings
from app.automation.utils.logger import log
from app.automation.utils.file_utils import encode_image
from app.services.few_shot_examples import FewShotExampleGenerator
from app.services.content_generator import ContentGenerator
from app.services.video_learning_service import VideoLearningService


class VisionAgent:
    """LLM‑powered planner for UI automation.

    Args:
        model: Name of the OpenAI model to use. Defaults to the value in
            `settings.LLM_MODEL`.
        api_key: API key for OpenAI. Defaults to the value in
            `settings.OPENAI_API_KEY`.
    """

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None) -> None:
        model = model or settings.LLM_MODEL
        api_key = api_key or settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for VisionAgent")
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        self.video_learning_context = None  # Will be loaded from demo videos
        self.few_shot_generator = FewShotExampleGenerator()  # Initialize few-shot example generator
        self.content_generator = ContentGenerator()  # Initialize content generator for documents
        self.video_learning_service = VideoLearningService()  # Initialize video learning from data directory

    async def decide_next_action(
        self,
        screenshot_path: str,
        goal: str,
        observation: Dict[str, Any],
        previous_actions: List[str],
        form_data: Optional[Dict[str, str]] = None,
        learned_guidance: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Determine the next action using the LLM.

        Args:
            screenshot_path: Path to the screenshot representing the current
                page state.
            goal: High level goal the agent is trying to accomplish.
            observation: A dict summarising the DOM (see dom_parser.parse_dom).
            previous_actions: List of strings describing previously taken
                actions. This context helps the LLM maintain continuity.
            form_data: Optional dictionary of field names and values extracted
                from the task description. When filling forms, use these values
                instead of generating new ones.
            learned_guidance: Optional guidance from the learning system about
                successful patterns, common failures, and recovery strategies.

        Returns:
            A dictionary representing the next action. Expected keys
            include `type`, `target_text`, `selector`, `value`, `capture`
            and `reason`.
        """
        base64_img = encode_image(screenshot_path)

        # Get relevant few-shot examples based on the goal/task
        few_shot_examples = self.few_shot_generator.get_examples_for_task(goal, num_examples=3)
        few_shot_prompt = self.few_shot_generator.format_examples_for_prompt(few_shot_examples)
        
        # Get video demonstration examples from data directory
        video_examples_text = ""
        try:
            video_examples = await self.video_learning_service.get_examples_for_task(goal)
            if video_examples:
                video_examples_text = "\n\n**EXAMPLES FROM VIDEO DEMONSTRATIONS:**\n"
                for i, example in enumerate(video_examples, 1):
                    video_examples_text += f"\n**Example {i}: {example['task']}**\n"
                    video_examples_text += f"Source: {example['video']}\n"
                    video_examples_text += f"Description: {example['description']}\n"
                    if 'workflow' in example and 'steps' in example['workflow']:
                        video_examples_text += "Key Steps:\n"
                        for step in example['workflow']['steps'][:5]:  # Show first 5 steps
                            video_examples_text += f"  {step['step']}. {step['action'].upper()}: {step['description']}\n"
                    video_examples_text += "\n"
                log(f"Added {len(video_examples)} video examples to agent context")
        except Exception as e:
            log(f"Could not load video examples: {e}")

        # Compose system and user prompts. The system prompt describes the
        # agent's role and the required JSON format. The user prompt
        # includes the goal, the current observation and the action
        # history.
        
        # Add learned guidance if available
        learned_guidance_text = ""
        if learned_guidance:
            from app.services.workflow_learner import WorkflowLearner
            learner = WorkflowLearner()  # Temporary instance for formatting
            learned_guidance_text = learner.format_guidance_for_prompt(learned_guidance)
        
        system_prompt = (
            "You are a vision‑driven automation agent. **ANALYZE THE SCREENSHOT CAREFULLY** before deciding actions.\n\n"
            "You have been trained on demonstration videos showing how to complete similar workflows.\n"
            "Study the examples below to understand the step-by-step patterns, then apply them to the current task.\n\n"
            f"{few_shot_prompt}\n\n"
            f"{video_examples_text}\n\n" if video_examples_text else ""
            f"{learned_guidance_text}\n\n" if learned_guidance_text else ""
            "CRITICAL: SCREENSHOT-FIRST APPROACH:\n"
            "1. **LOOK AT THE ACTUAL SCREENSHOT** - Base decisions on what you SEE, not what you assume\n"
            "2. Identify if overlays, modals, or dropdowns are blocking main content\n"
            "3. Check sidebar navigation for relevant sections (Issues, Projects, Views, Settings)\n"
            "4. Look for buttons/links visible in the CURRENT state\n"
            "5. If you tried an action before and it failed, choose a DIFFERENT element you see in the screenshot\n"
            "6. **CRITICAL: If you don't see what you're looking for on current screen:**\n"
            "   - Check if you're on the wrong page/section\n"
            "   - Consider going BACK to previous page (type='back')\n"
            "   - Try a different navigation path from the previous page\n"
            "   - Don't keep clicking the same thing hoping it will work\n\n"
            "WHEN TO GO BACK (type='back'):\n"
            "- You clicked something but ended up on empty/wrong page\n"
            "- The element you need is not visible and won't be on this page\n"
            "- You've tried multiple elements on this page and none work\n"
            "- Previous page had other options you didn't try yet\n"
            "- You're stuck in a section that doesn't have what you need\n\n"
            "SELECTOR RULES:\n"
            "- VALID: 'button', 'a.login-button', '[data-testid=\"submit\"]', 'text=Button Text'\n"
            "- INVALID: 'button:contains(\"text\")', ':contains()', jQuery selectors\n"
            "- If unsure, set selector=null and provide clear 'target_text' (exact visible text)\n\n"
            "GENERIC NAVIGATION PRINCIPLES:\n"
            "- If dropdowns/overlays are blocking content, press Escape or click outside to close\n"
            "- For navigation: look in LEFT SIDEBAR first, then top navigation bar\n"
            "- CRITICAL: Don't repeatedly click the same element - if it doesn't work after 1 try, choose DIFFERENT element\n"
            "- If you see 'Open', 'Go to', or 'Launch' buttons on app cards, click those instead of app names\n"
            "- If URL doesn't change after clicking, the element may be wrong or blocked by overlay - TRY DIFFERENT ELEMENT\n"
            "- Always check screenshot for what's ACTUALLY visible, not what you assume should be there\n"
            "- If previous_actions shows 'FAILED:' entries, DO NOT repeat those same actions\n"
            "- Look for alternative paths: different buttons, links, menu items, keyboard shortcuts\n"
            "- If stuck on same page after multiple clicks, try: scroll down, look for '+' icons, check top-right corner for 'New' buttons\n\n"
            "FORM FILLING RULES:\n"
            "- When form_data is provided with field values, USE THEM EXACTLY\n"
            "- Match form field labels/placeholders to form_data keys (case-insensitive)\n"
            "- Common mappings: 'name'/'title'/'project name' → form_data['name'], 'description'/'details' → form_data['description']\n"
            "- For 'type' actions, check if form_data contains a matching field before generating values\n"
            "- Example: If filling 'Project Name' field and form_data has 'name': 'Q4 Campaign', set value='Q4 Campaign'\n"
            "- Only generate values yourself if NOT in form_data\n\n"
            "TASK COMPLETION RECOGNITION:\n"
            "- Look for SUCCESS indicators: checkmarks, 'Created successfully', new items appearing in lists\n"
            "- For document creation: document editor is open with title set = SUCCESS\n"
            "- For project/issue creation: new item visible in list/board = SUCCESS\n"
            "- For navigation: target page/section is visible = SUCCESS\n"
            "- If you see clear evidence task is complete, return type='done' with detailed reason\n\n"
            "BACKTRACKING STRATEGY:\n"
            "- If you can't find the element you're looking for on current screen\n"
            "- If previous actions failed and you're stuck on the same page\n"
            "- If you clicked something but it led to a dead end\n"
            "- Return type='back' to go to previous page and try a different approach\n"
            "- Example: Clicked 'Projects' but it's empty → go back and try 'Create Project' instead\n\n"
            "RESPONSE FORMAT (JSON):\n"
            "{\n"
            "  \"type\": \"click\" | \"type\" | \"keyboard\" | \"wait\" | \"scroll\" | \"back\" | \"done\",\n"
            "  \"target_text\": \"Exact visible text from screenshot\",\n"
            "  \"selector\": \"valid selector or null\",\n"
            "  \"value\": \"text/key/seconds\",\n"
            "  \"capture\": true/false,\n"
            "  \"reason\": \"WHY this action based on what you SEE (if type=done, explain what success indicators you see)\"\n"
            "}\""
        )

        # Build form data context string
        form_data_context = ""
        if form_data:
            form_data_context = (
                f"\n**PROVIDED FORM DATA (USE THESE VALUES):**\n"
                f"{json.dumps(form_data, indent=2)}\n"
                "When filling forms, match field labels to these keys and use the provided values.\n"
            )

        user_prompt = {
            "type": "text",
            "text": (
                f"**SCREENSHOT ANALYSIS REQUIRED**\n\n"
                f"Goal: {goal}\n"
                f"Current URL: {observation.get('url')}\n"
                f"Previous actions: {previous_actions}\n"
                f"{form_data_context}\n"
                "**CRITICAL: Check for failed actions above**\n"
                "- Any actions marked 'FAILED:' did NOT work - DO NOT repeat them\n"
                "- If you see repeated failures, you MUST try a DIFFERENT approach\n"
                "- PAGE_HISTORY shows which pages you've visited - helps decide if you need to go back\n\n"
                "**STEP 1: Analyze the screenshot**\n"
                "- What is the current page state? What page am I on?\n"
                "- Did the previous action change the page/URL? If not, WHY?\n"
                "- Can I see the element I need on THIS screen?\n"
                "- Are there overlays/dropdowns blocking content?\n"
                "- What navigation elements are visible in the sidebar?\n"
                "- What buttons/links are clickable?\n"
                "- Are there any '+' icons, 'New' buttons, or 'Create' buttons visible?\n\n"
                f"**STEP 2: Check if task is already complete**\n"
                f"- Does the screenshot show the task goal is already achieved?\n"
                f"  - For document creation: Is editor open with correct title?\n"
                f"  - For project creation: Is new project visible in list?\n"
                f"  - For navigation: Are we on the target page/section?\n"
                f"  - Look for success messages, new items, or completed states\n"
                f"- If YES, return type='done' with reason explaining success indicators\n\n"
                f"**STEP 3: Check if stuck and need to backtrack**\n"
                f"- Are you on a page where the element you need is NOT visible?\n"
                f"- Did you click something but it led to an empty page or wrong section?\n"
                f"- Have previous actions FAILED on this same screen multiple times?\n"
                f"- If YES to any: return type='back' to go to previous page and try different path\n\n"
                f"**STEP 4: Decide next action if not complete and not stuck**\n"
                "- If previous action didn't work (same page), try DIFFERENT element - NOT the same one!\n"
                "- If stuck on home page, look for 'Open', 'Go to', or navigation links\n"
                "- If overlay is open, close it (Escape or click outside)\n"
                "- If sidebar has relevant section, click it\n"
                "- If form fields need filling, provide exact field names\n"
                "- If button is visible, provide EXACT text from screenshot\n"
                "- Look in top-right corner for action buttons (New, Create, Add, etc.)\n"
                "- Consider scrolling if content might be below fold\n\n"                f"**BACKTRACKING DECISION GUIDE:**\n"
                f"- If you clicked 'Projects' but see empty list → go back, try 'New Project' instead\n"
                f"- If you're in a section without what you need → go back, try different section\n"
                f"- If you tried 3+ things on this page with no success → go back to previous page\n"
                f"- When going back, mention in 'reason' what alternative you'll try next\n\n"                "Return JSON with your action based on screenshot analysis."
            ),
        }

        image_content = {
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{base64_img}"},
        }

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [user_prompt, image_content]},
        ]

        log("Querying OpenAI for next action...")
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=500,
        )
        content = response.choices[0].message.content
        if not content:
            log("LLM returned no content; using fallback 'wait' action.")
            return {
                "type": "wait",
                "target_text": "",
                "selector": None,
                "value": "2",
                "capture": False,
                "reason": "LLM returned no content",
            }
        try:
            action = json.loads(content)
        except Exception as e:
            log(f"Failed to parse LLM output as JSON: {e}\nContent: {content}")
            return {
                "type": "wait",
                "target_text": "",
                "selector": None,
                "value": "2",
                "capture": False,
                "reason": "LLM output could not be parsed",
            }
        return action

    async def learn_from_demo_videos(self) -> Dict[str, Any]:
        """Analyze demonstration videos to learn workflow patterns and reporting structure.
        
        This method examines all demo videos in the /data folder to understand:
        1. Common workflow patterns (navigation, form filling, verification)
        2. Success criteria for different task types
        3. How to structure comprehensive reports
        4. What makes good ending notes
        
        Returns:
            Dictionary containing learned patterns and report templates
        """
        try:
            data_dir = Path("/Users/pavankumarmalasani/Downloads/ui_capture_system/data")
            
            if not data_dir.exists():
                log("Demo videos directory not found")
                return self._get_default_learning_context()
            
            video_files = list(data_dir.glob("*.mp4"))
            
            if not video_files:
                log("No demo videos found in /data folder")
                return self._get_default_learning_context()
            
            log(f"Learning from {len(video_files)} demonstration videos...")
            
            # Build learning context from video analysis
            learning_prompt = self._build_video_learning_prompt(video_files)
            
            # Query LLM to analyze the demo videos and extract patterns
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an expert at analyzing workflow demonstration videos and extracting patterns. "
                        "Your task is to study the video names and descriptions to understand:\n"
                        "1. Common workflow patterns (step-by-step approaches)\n"
                        "2. What success criteria matter for each workflow type\n"
                        "3. How to write comprehensive reports\n"
                        "4. What makes effective ending notes\n\n"
                        "Return a structured JSON with your analysis."
                    )
                },
                {
                    "role": "user",
                    "content": learning_prompt
                }
            ]
            
            log("Analyzing demo videos with LLM...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
                max_tokens=2000,
            )
            
            content = response.choices[0].message.content
            if content:
                self.video_learning_context = json.loads(content)
                log(f"✓ Learned patterns from {len(video_files)} videos")
                return self.video_learning_context
            else:
                return self._get_default_learning_context()
                
        except Exception as e:
            log(f"Error learning from demo videos: {e}")
            return self._get_default_learning_context()
    
    def _build_video_learning_prompt(self, video_files: List[Path]) -> str:
        """Build a prompt for the LLM to analyze demo videos."""
        video_descriptions = []
        
        for video in video_files:
            # Extract task description from filename
            task_name = video.stem.replace("-", " ").replace("_", " ")
            
            # Categorize the video
            category = self._categorize_video(task_name)
            
            video_descriptions.append({
                "filename": video.name,
                "task": task_name,
                "category": category,
                "file_size_mb": round(video.stat().st_size / (1024 * 1024), 2)
            })
        
        prompt = f"""
I have {len(video_files)} demonstration videos showing complete workflows:

{json.dumps(video_descriptions, indent=2)}

Based on these demonstrations, analyze and extract:

1. **Common Workflow Patterns** by category:
   - What steps are typical for each workflow type?
   - What's the usual sequence (navigate → wait → interact → verify)?
   - What verification steps are critical?

2. **Success Criteria** for each category:
   - What indicates successful completion?
   - What should be verified at the end?
   - What are common failure points?

3. **Report Writing Guidelines**:
   - What sections should a comprehensive report have?
   - What level of detail is appropriate for each section?
   - How to balance technical accuracy with readability?

4. **Ending Note Best Practices**:
   - What makes an effective ending note?
   - What key information should it summarize?
   - How to provide actionable next steps?
   - How to reference the demonstration video that was followed?

5. **Task-Specific Patterns**:
   For each category, what are the unique considerations?

Return your analysis as structured JSON with these sections:
{{
  "workflow_patterns": {{}},
  "success_criteria": {{}},
  "report_structure": {{}},
  "ending_note_template": "",
  "task_specific_guidance": {{}}
}}
"""
        return prompt
    
    def _categorize_video(self, task_name: str) -> str:
        """Categorize a video based on its task name."""
        task_lower = task_name.lower()
        
        if any(word in task_lower for word in ["jira", "linear", "project", "task"]):
            return "project_management"
        elif any(word in task_lower for word in ["docs", "document", "google"]):
            return "document_creation"
        elif any(word in task_lower for word in ["medium", "article", "summariz"]):
            return "content_research"
        elif any(word in task_lower for word in ["flight", "booking", "frontier"]):
            return "travel_booking"
        elif any(word in task_lower for word in ["crocs", "sales", "shop"]):
            return "ecommerce"
        else:
            return "general"
    
    def _get_default_learning_context(self) -> Dict[str, Any]:
        """Return default learning context when videos can't be analyzed."""
        return {
            "workflow_patterns": {
                "general": [
                    "Navigate to the target application",
                    "Wait for page to fully load",
                    "Locate and interact with UI elements",
                    "Fill forms with required data",
                    "Submit and verify success",
                    "Confirm final state matches goal"
                ]
            },
            "success_criteria": {
                "general": [
                    "Task objective is achieved",
                    "No error messages displayed",
                    "Expected data is visible and correct",
                    "User is in the expected final state"
                ]
            },
            "report_structure": {
                "sections": [
                    "Executive Summary",
                    "Workflow Steps Executed",
                    "Success Criteria Met",
                    "Issues Encountered",
                    "Final Verification",
                    "Ending Note"
                ],
                "detail_level": "Include action descriptions, results, and verification points"
            },
            "ending_note_template": (
                "Workflow completed successfully. Task '{task}' was accomplished following "
                "demonstrated patterns. All verification checks passed. "
                "Key achievements: {achievements}. "
                "System is ready for additional workflows."
            ),
            "task_specific_guidance": {
                "project_management": "Verify project/task is created, assigned, and visible in listings",
                "document_creation": "Confirm document is saved, titled correctly, and contains expected content",
                "content_research": "Ensure articles were found, opened, and key information extracted",
                "travel_booking": "Validate flight selection, passenger details, and booking summary",
                "ecommerce": "Check items in cart, quantities correct, ready for checkout"
            }
        }
    
    async def generate_comprehensive_report(
        self,
        task: str,
        actions_taken: List[Dict[str, Any]],
        success: bool,
        final_state: Dict[str, Any]
    ) -> str:
        """Generate a comprehensive report based on learned patterns from demo videos.
        
        Args:
            task: The original task description
            actions_taken: List of all actions executed
            success: Whether the workflow completed successfully
            final_state: Final page state and verification results
            
        Returns:
            Comprehensive report text with ending note
        """
        try:
            # Load video learning context if not already loaded
            if not self.video_learning_context:
                self.video_learning_context = await self.learn_from_demo_videos()
            
            # Build report generation prompt
            report_prompt = f"""
Based on the demonstration videos you've studied, generate a comprehensive workflow execution report.

**Task**: {task}
**Success**: {success}
**Actions Taken**: {len(actions_taken)} steps

**Action Details**:
{json.dumps(actions_taken, indent=2)}

**Final State**:
{json.dumps(final_state, indent=2)}

**Your Learning Context** (from demo videos):
{json.dumps(self.video_learning_context, indent=2)}

Generate a report following the structure and style learned from the demonstrations.
Include:

1. **Executive Summary**: Brief overview of what was accomplished
2. **Workflow Steps**: Detailed breakdown of each action
3. **Success Criteria**: What was verified and confirmed
4. **Issues Encountered**: Any problems or warnings
5. **Final Verification**: Confirmation of end state
6. **Ending Note**: Comprehensive summary following the learned template

The ending note should:
- Reference the task completion status
- Highlight key achievements
- Mention any patterns followed from demonstrations
- Provide context for next steps
- Be professional yet informative

Return a well-formatted markdown report.
"""
            
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an expert report writer who has studied workflow demonstration videos. "
                        "Generate comprehensive, professional reports that follow the patterns and structures "
                        "learned from real demonstrations. Your reports should be detailed yet readable, "
                        "technical yet accessible."
                    )
                },
                {
                    "role": "user",
                    "content": report_prompt
                }
            ]
            
            log("Generating comprehensive report based on learned patterns...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=2000,
            )
            
            report_content = response.choices[0].message.content
            if report_content:
                log("✓ Report generated successfully")
                return report_content
            else:
                return self._generate_fallback_report(task, actions_taken, success)
                
        except Exception as e:
            log(f"Error generating report: {e}")
            return self._generate_fallback_report(task, actions_taken, success)
    
    def _generate_fallback_report(
        self,
        task: str,
        actions_taken: List[Dict[str, Any]],
        success: bool
    ) -> str:
        """Generate a basic report when LLM-based generation fails."""
        status = "✅ COMPLETED" if success else "⚠️ INCOMPLETE"
        
        report = f"""
# Workflow Execution Report

## Executive Summary
{status}

**Task**: {task}
**Total Steps**: {len(actions_taken)}
**Status**: {'Successfully completed' if success else 'Partially completed'}

## Workflow Steps

"""
        for i, action in enumerate(actions_taken, 1):
            action_type = action.get('type', 'unknown')
            reason = action.get('reason', 'No reason provided')
            report += f"{i}. **{action_type.upper()}**: {reason}\n"
        
        report += f"""

## Ending Note

Workflow execution {'completed successfully' if success else 'encountered issues'}. 
Task '{task}' was processed with {len(actions_taken)} actions. 
{'All verification checks passed.' if success else 'Some steps may require manual review.'}
System is ready for additional workflows.
"""
        return report