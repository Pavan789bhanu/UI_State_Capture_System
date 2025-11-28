"""Configuration values for the UI capture system.

These values are loaded from environment variables when present. They
control where screenshots are stored, where Playwright persists
browser data, and contain secrets used for authenticating into third‑
party services. See the accompanying README for details on setting up
your own `.env` file.
"""

import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from a .env file if present. This call is
# idempotent and will silently succeed if no file exists.
load_dotenv()

# Directory to save captured screenshots and metadata.
SCREENSHOT_DIR: str = os.getenv("SCREENSHOT_DIR", "./captured_dataset")

# Directory used by Playwright to persist browser state. When using a
# persistent context this directory will contain cookies, local
# storage, IndexedDB, history and other on‑disk state. If you delete
# this folder the agent will be forced to authenticate again.
USER_DATA_DIR: str = os.getenv("USER_DATA_DIR", "./browser_session_data")

# Optional path to store Playwright storage state. When supplied and
# the file exists, the BrowserManager will load authentication state
# from this file into a new context. You can set this value to
# something like "./storage_state.json" if you prefer not to use
# persistent contexts. Note: this is ignored when using
# launch_persistent_context().
STORAGE_STATE_PATH: str = os.getenv("STORAGE_STATE_PATH", "./storage_state.json")

# Credentials for authenticating via login forms or OAuth providers.
LOGIN_EMAIL: Optional[str] = os.getenv("LOGIN_EMAIL")
LOGIN_PASSWORD: Optional[str] = os.getenv("LOGIN_PASSWORD")

# OpenAI API key and model used by the VisionAgent. The API key must
# correspond to an OpenAI account with access to the specified model.
OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o")

# Default timeout used throughout the system (in milliseconds).
TIMEOUT: int = int(os.getenv("TIMEOUT", "10000"))

# Screenshot Analysis Settings
SCREENSHOT_DEDUPLICATION_ENABLED: bool = os.getenv("SCREENSHOT_DEDUPLICATION_ENABLED", "true").lower() == "true"
SCREENSHOT_DEDUPLICATION_THRESHOLD: int = int(os.getenv("SCREENSHOT_DEDUPLICATION_THRESHOLD", "20"))  # 0-5: identical, 6-15: very similar, 16-25: similar, 26+: different
SCREENSHOT_DELETE_DUPLICATES: bool = os.getenv("SCREENSHOT_DELETE_DUPLICATES", "true").lower() == "true"  # Delete duplicate screenshots from disk

# Application URL mappings for common SaaS apps (extensible)
# Users can override by setting APP_URL_MAPPINGS in .env as JSON string
# Format: {"app_name": "url", "another_app": "url"}
DEFAULT_APP_URL_MAPPINGS = {
    "notion": "https://www.notion.so",
    "linear": "https://linear.app",
    "slack": "https://app.slack.com",
    "asana": "https://app.asana.com",
    "monday": "https://monday.com",
    "github": "https://github.com",
    "gitlab": "https://gitlab.com",
    "jira": "https://id.atlassian.com/login",
    "confluence": "https://id.atlassian.com/login",
    "figma": "https://figma.com",
    "trello": "https://trello.com",
    "miro": "https://miro.com",
    "airtable": "https://airtable.com",
    "google drive": "https://drive.google.com",
    "google docs": "https://docs.google.com",
    "google sheets": "https://sheets.google.com",
    "google calendar": "https://calendar.google.com",
    "gmail": "https://mail.google.com",
    "salesforce": "https://salesforce.com",
    "hubspot": "https://app.hubspot.com",
    "zendesk": "https://zendesk.com",
    "intercom": "https://app.intercom.io",
    "linkedin": "https://www.linkedin.com/feed/",
}

# Load custom mappings from environment if provided (JSON format)
import json
_custom_mappings = os.getenv("APP_URL_MAPPINGS")
if _custom_mappings:
    try:
        APP_URL_MAPPINGS = {**DEFAULT_APP_URL_MAPPINGS, **json.loads(_custom_mappings)}
    except json.JSONDecodeError:
        APP_URL_MAPPINGS = DEFAULT_APP_URL_MAPPINGS
else:
    APP_URL_MAPPINGS = DEFAULT_APP_URL_MAPPINGS