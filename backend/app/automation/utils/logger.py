"""Simple logging utilities.

Functions defined here prepend a timestamp to log messages. In a more
sophisticated system you could swap this out for Python's `logging`
module or a third‑party structured logger, but for demonstration
purposes a simple print suffices.
"""

from __future__ import annotations

import datetime
import re

def _mask_sensitive_data(message: str) -> str:
    """Mask sensitive information like emails, passwords, and API keys."""
    # Mask email addresses
    message = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', message)
    
    # Mask API keys (common patterns)
    message = re.sub(r'sk-[a-zA-Z0-9]{20,}', '[API_KEY]', message)
    message = re.sub(r'api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9_-]{10,}', '[API_KEY]', message, flags=re.IGNORECASE)
    
    # Mask common password patterns
    message = re.sub(r'password["\']?\s*[:=]\s*["\']?[^\"\s,}]+', '[PASSWORD]', message, flags=re.IGNORECASE)
    message = re.sub(r'pass["\']?\s*[:=]\s*["\']?[^\"\s,}]+', '[PASSWORD]', message, flags=re.IGNORECASE)
    
    return message

def log(message: str) -> None:
    """Print a timestamped log message.

    Args:
        message: The message to print.
    """
    timestamp = datetime.datetime.now().isoformat()
    masked_message = _mask_sensitive_data(message)
    print(f"[{timestamp}] {masked_message}")