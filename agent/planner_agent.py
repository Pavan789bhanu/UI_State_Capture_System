"""Task planner agent that creates multi-step plans from natural language tasks.

The `PlannerAgent` uses an LLM to break down user tasks into structured,
sequential steps. It helps coordinate complex workflows by planning out
navigation, authentication, screenshots, and task execution in the right order.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI

from config import OPENAI_API_KEY, LLM_MODEL
from utils.logger import log


class PlannerAgent:
    """LLM-powered task planner.

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
            raise ValueError("OPENAI_API_KEY is required for PlannerAgent")
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def plan_task(
        self,
        task: str,
        app_name: str,
        app_url: str,
    ) -> Dict[str, Any]:
        """Create a structured plan for completing a user task.

        Args:
            task: The user's natural language task description.
            app_name: The name of the web app (e.g., "MyApp", "TaskManager").
            app_url: The URL of the app (e.g., "https://myapp.com").

        Returns:
            A dictionary containing:
            - "steps": List of step dictionaries, each with:
                - "step_number": int
                - "name": str (human-readable step name)
                - "description": str (what to do)
                - "type": str (one of: navigate, login, screenshot, interact, verify)
                - "selector": str or null (CSS selector if applicable)
                - "action": str or null (action type: click, type, etc.)
                - "expected_result": str (what we expect to see after this step)
            - "total_steps": int
            - "app_name": str
            - "app_url": str
        """
        system_prompt = (
            "You are a task planning agent. Your job is to break down a user's natural language task "
            "into a detailed, sequential plan of steps for interacting with a web app. "
            "Each step should be atomic and executable.\n\n"
            "Step types:\n"
            "- navigate: Go to a URL\n"
            "- login: Perform authentication\n"
            "- screenshot: Capture the current state\n"
            "- interact: Click, type, or perform an action\n"
            "- verify: Check that a condition is met\n\n"
            "Always return valid JSON with the structure:\n"
            "{\n"
            '  "steps": [\n'
            "    {\n"
            '      "step_number": 1,\n'
            '      "name": "Navigate to app",\n'
            '      "description": "...",\n'
            '      "type": "navigate",\n'
            '      "selector": null,\n'
            '      "action": null,\n'
            '      "expected_result": "App homepage loads"\n'
            "    },\n"
            "    ...\n"
            "  ],\n"
            '  "total_steps": N,\n'
            '  "app_name": "...",\n'
            '  "app_url": "..."\n'
            "}"
        )

        user_prompt = (
            f"Task: {task}\n"
            f"App Name: {app_name}\n"
            f"App URL: {app_url}\n\n"
            "Create a detailed step-by-step plan for completing this task.\n"
            "IMPORTANT:\n"
            "1. Include initial navigation to the app URL\n"
            "2. Include login step if the task requires authentication\n"
            "3. Take screenshots at key milestones (after login, after finding the database, before/after filters)\n"
            "4. For interact steps, be VERY specific about what to click/type and provide clear, unambiguous descriptions\n"
            "5. Focus on the core task - finding and filtering databases\n"
            "6. Use clear, actionable descriptions that will help identify UI elements\n"
            "7. End with verification that shows the filtered result\n\n"
            "GENERIC PLANNING PRINCIPLES:\n"
            "- Break complex tasks into atomic steps (navigate, find element, click/type, verify)\n"
            "- After login, include a step to navigate to the relevant section/feature\n"
            "- For creation tasks: navigate to creation area → fill required fields → submit → verify\n"
            "- Take screenshots at key milestones to track progress\n"
            "- Include verification step at the end to confirm task completion\n"
            "- If task requires prerequisites (e.g., workspace before project), include those steps first\n\n"
            "Example good interact step: 'Fill the Workspace Name field with a name like \"My Team\"'\n"
            "Example bad interact step: 'Click on filter option'\n\n"
            "Return valid JSON format."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        log("Querying OpenAI for task plan...")
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=2000,
        )

        content = response.choices[0].message.content
        if not content:
            log("Planner returned no content; using default plan.")
            return self._default_plan(task, app_name, app_url)

        try:
            plan = json.loads(content)
            return plan
        except Exception as e:
            log(f"Failed to parse plan JSON: {e}. Using default plan.")
            return self._default_plan(task, app_name, app_url)

    def _default_plan(self, task: str, app_name: str, app_url: str) -> Dict[str, Any]:
        """Return a sensible default plan when LLM planning fails."""
        return {
            "steps": [
                {
                    "step_number": 1,
                    "name": "Navigate to app",
                    "description": f"Navigate to {app_name} at {app_url}",
                    "type": "navigate",
                    "selector": None,
                    "action": None,
                    "expected_result": f"{app_name} homepage or login page loads",
                },
                {
                    "step_number": 2,
                    "name": "Login",
                    "description": "Authenticate with email and password",
                    "type": "login",
                    "selector": None,
                    "action": None,
                    "expected_result": "Successfully logged in; dashboard or home page visible",
                },
                {
                    "step_number": 3,
                    "name": "Screenshot dashboard",
                    "description": "Capture screenshot of the dashboard/home page",
                    "type": "screenshot",
                    "selector": None,
                    "action": None,
                    "expected_result": "Screenshot saved",
                },
                {
                    "step_number": 4,
                    "name": "Complete task",
                    "description": task,
                    "type": "interact",
                    "selector": None,
                    "action": None,
                    "expected_result": "Task completed successfully",
                },
            ],
            "total_steps": 4,
            "app_name": app_name,
            "app_url": app_url,
        }
