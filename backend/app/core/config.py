from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

# Get project root (3 levels up from this file)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"

class Settings(BaseSettings):
    """Application settings."""
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "UI Capture System"
    VERSION: str = "1.0.0"
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5179",
        "http://localhost:5176",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5176",
    ]
    
    # Database (SQLite for simplicity, can upgrade to PostgreSQL later)
    DATABASE_URL: str = f"sqlite:///{BACKEND_ROOT}/ui_capture.db"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 7  # 7 days
    
    # OpenAI (for automation)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o")
    
    # Automation Settings
    SCREENSHOT_DIR: Path = PROJECT_ROOT / "captured_dataset"
    
    # Workflow Engine Configuration
    LOOP_DETECTION_WINDOW: int = 6  # Number of actions to analyze for loop detection
    MAX_INACTIVITY_SECONDS: int = 30  # Max time without progress before timeout
    MAX_ADAPTIVE_CYCLES: int = 6  # Max extra cycles for adaptive workflows
    
    # URL Validation (SSRF Prevention)
    BLOCKED_IP_RANGES: List[str] = [
        "127.0.0.0/8",      # Localhost
        "10.0.0.0/8",       # Private network
        "172.16.0.0/12",    # Private network
        "192.168.0.0/16",   # Private network
        "169.254.0.0/16",   # Link-local
        "::1/128",          # IPv6 localhost
        "fc00::/7",         # IPv6 private
    ]
    BLOCKED_URL_SCHEMES: List[str] = ["file", "ftp", "data", "javascript"]
    ALLOWED_URL_SCHEMES: List[str] = ["http", "https"]
    USER_DATA_DIR: Path = PROJECT_ROOT / "browser_session_data"
    STORAGE_STATE_PATH: Path = PROJECT_ROOT / "storage_state.json"
    DATA_DIR: Path = PROJECT_ROOT / "data"
    
    # Browser Settings
    TIMEOUT: int = int(os.getenv("TIMEOUT", "10000"))
    DEFAULT_HEADLESS: bool = os.getenv("DEFAULT_HEADLESS", "false").lower() == "true"
    
    # Screenshot Analysis
    SCREENSHOT_DEDUPLICATION_ENABLED: bool = True
    SCREENSHOT_DEDUPLICATION_THRESHOLD: int = 20
    SCREENSHOT_DELETE_DUPLICATES: bool = True
    
    # Login Credentials (optional, for automation)
    LOGIN_EMAIL: Optional[str] = os.getenv("LOGIN_EMAIL")
    LOGIN_PASSWORD: Optional[str] = os.getenv("LOGIN_PASSWORD")
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Validate required secrets
        if not self.SECRET_KEY:
            raise ValueError(
                "SECRET_KEY environment variable is required. "
                "Generate one with: openssl rand -hex 32"
            )
        if not self.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required for AI automation."
            )
    
    
    class Config:
        env_file = str(PROJECT_ROOT / ".env")
        case_sensitive = True

# Default app URL mappings
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

# Create singleton instance
settings = Settings()

# App URL mappings (can be customized via environment)
import json
_custom_mappings = os.getenv("APP_URL_MAPPINGS")
if _custom_mappings:
    try:
        APP_URL_MAPPINGS = {**DEFAULT_APP_URL_MAPPINGS, **json.loads(_custom_mappings)}
    except json.JSONDecodeError:
        APP_URL_MAPPINGS = DEFAULT_APP_URL_MAPPINGS
else:
    APP_URL_MAPPINGS = DEFAULT_APP_URL_MAPPINGS

# Create necessary directories
settings.SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
settings.USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

