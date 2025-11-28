"""Vision‑driven planning agent.

`VisionAgent` leverages an LLM (such as OpenAI's GPT models) to plan
the next action in a UI workflow. It takes the current screenshot,
extracted DOM elements and the high level goal as input and returns
a structured JSON describing the recommended action.

This design decouples perception from planning. The agent does not
directly interact with the browser; instead it merely decides what
should happen next. See `workflow_engine.py` for execution logic.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from config import OPENAI_API_KEY, LLM_MODEL
from utils.logger import log
from utils.file_utils import encode_image


class VisionAgent:
    """LLM‑powered planner for UI automation.

    Args:
        model: Name of the OpenAI model to use. Defaults to the value in
            `config.LLM_MODEL`.
        api_key: API key for OpenAI. Defaults to the value in
            `config.OPENAI_API_KEY`.
    """

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None) -> None:
        model = model or LLM_MODEL
        api_key = api_key or OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for VisionAgent")
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def decide_next_action(
        self,
        screenshot_path: str,
        goal: str,
        observation: Dict[str, Any],
        previous_actions: List[str],
    ) -> Dict[str, Any]:
        """Determine the next action using the LLM.

        Args:
            screenshot_path: Path to the screenshot representing the current
                page state.
            goal: High level goal the agent is trying to accomplish.
            observation: A dict summarising the DOM (see dom_parser.parse_dom).
            previous_actions: List of strings describing previously taken
                actions. This context helps the LLM maintain continuity.

        Returns:
            A dictionary representing the next action. Expected keys
            include `type`, `target_text`, `selector`, `value`, `capture`
            and `reason`.
        """
        base64_img = encode_image(screenshot_path)

        # Compose system and user prompts. The system prompt describes the
        # agent's role and the required JSON format. The user prompt
        # includes the goal, the current observation and the action
        # history.
        system_prompt = (
            "You are a vision‑driven automation agent. **ANALYZE THE SCREENSHOT CAREFULLY** before deciding actions.\n\n"
            "CRITICAL: SCREENSHOT-FIRST APPROACH:\n"
            "1. **LOOK AT THE ACTUAL SCREENSHOT** - Base decisions on what you SEE, not what you assume\n"
            "2. Identify if overlays, modals, or dropdowns are blocking main content\n"
            "3. Check sidebar navigation for relevant sections (Issues, Projects, Views, Settings)\n"
            "4. Look for buttons/links visible in the CURRENT state\n"
            "5. If you tried an action before and it failed, choose a DIFFERENT element you see in the screenshot\n\n"
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
            "RESPONSE FORMAT (JSON):\n"
            "{\n"
            "  \"type\": \"click\" | \"type\" | \"keyboard\" | \"wait\" | \"scroll\",\n"
            "  \"target_text\": \"Exact visible text from screenshot\",\n"
            "  \"selector\": \"valid selector or null\",\n"
            "  \"value\": \"text/key/seconds\",\n"
            "  \"capture\": true/false,\n"
            "  \"reason\": \"WHY this action based on what you SEE\"\n"
            "}\""
        )

        user_prompt = {
            "type": "text",
            "text": (
                f"**SCREENSHOT ANALYSIS REQUIRED**\n\n"
                f"Goal: {goal}\n"
                f"Current URL: {observation.get('url')}\n"
                f"Previous actions: {previous_actions}\n\n"
                "**CRITICAL: Check for failed actions above**\n"
                "- Any actions marked 'FAILED:' did NOT work - DO NOT repeat them\n"
                "- If you see repeated failures, you MUST try a DIFFERENT approach\n\n"
                "**STEP 1: Analyze the screenshot**\n"
                "- What is the current page state? What page am I on?\n"
                "- Did the previous action change the page/URL? If not, WHY?\n"
                "- Are there overlays/dropdowns blocking content?\n"
                "- What navigation elements are visible in the sidebar?\n"
                "- What buttons/links are clickable?\n"
                "- Are there any '+' icons, 'New' buttons, or 'Create' buttons visible?\n\n"
                "**STEP 2: Decide next action**\n"
                "- If previous action didn't work (same page), try DIFFERENT element - NOT the same one!\n"
                "- If stuck on home page, look for 'Open', 'Go to', or navigation links\n"
                "- If overlay is open, close it (Escape or click outside)\n"
                "- If sidebar has relevant section, click it\n"
                "- If form fields need filling, provide exact field names\n"
                "- If button is visible, provide EXACT text from screenshot\n"
                "- Look in top-right corner for action buttons (New, Create, Add, etc.)\n"
                "- Consider scrolling if content might be below fold\n\n"
                "Return JSON with your action based on screenshot analysis."
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