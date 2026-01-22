import re
import difflib
from typing import Optional, Tuple, Dict
from urllib.parse import urlparse

from app.core.config import APP_URL_MAPPINGS

URL_RE = re.compile(r"(?P<url>https?://[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)")


def extract_form_data(task: str) -> Dict[str, str]:
    """Extract form field data from task description.
    
    Looks for patterns like:
    - "with name 'Project Alpha'"
    - "titled 'Q4 Planning'"
    - "called 'Sprint 23'"
    - "name: Project X"
    - "title: Meeting Notes"
    - "description: This is a test"
    - "with content about RAG" (for document creation)
    - "document with title 'X' containing information about Y"
    
    Returns a dictionary of field names to values.
    
    Examples:
        "Create a project named 'Website Redesign' with description 'New landing page'"
        -> {"name": "Website Redesign", "description": "New landing page"}
        
        "Create meeting titled 'Daily Standup' for tomorrow"
        -> {"title": "Daily Standup"}
        
        "Create a Google Doc titled 'RAG Systems' with content about Retrieval Augmented Generation"
        -> {"title": "RAG Systems", "content_topic": "Retrieval Augmented Generation", "content_keywords": ["RAG", "retrieval", "augmented", "generation"]}
    """
    form_data = {}
    
    # Pattern 1: with/named/titled/called + single-quoted text
    single_quote_patterns = [
        (r"(?:with\s+)?name[d]?\s+'([^']+)'", "name"),
        (r"(?:with\s+)?title[d]?\s+'([^']+)'", "title"),
        (r"called\s+'([^']+)'", "name"),
        (r"titled\s+'([^']+)'", "title"),
        (r"(?:with\s+)?description[:\s]+'([^']+)'", "description"),
        (r"(?:with\s+)?agenda[:\s]+'([^']+)'", "agenda"),
        (r"(?:with\s+)?details?[:\s]+'([^']+)'", "details"),
        (r"(?:create|add|new)\s+(?:project|task|issue|meeting|document|doc)\s+'([^']+)'", "name"),  # "create project 'X'"
    ]
    
    # Pattern 2: with/named/titled/called + double-quoted text  
    double_quote_patterns = [
        (r'(?:with\s+)?name[d]?\s+"([^"]+)"', "name"),
        (r'(?:with\s+)?title[d]?\s+"([^"]+)"', "title"),
        (r'called\s+"([^"]+)"', "name"),
        (r'titled\s+"([^"]+)"', "title"),
        (r'(?:with\s+)?description[:\s]+"([^"]+)"', "description"),
        (r'(?:with\s+)?agenda[:\s]+"([^"]+)"', "agenda"),
        (r'(?:with\s+)?details?[:\s]+"([^"]+)"', "details"),
        (r'(?:create|add|new)\s+(?:project|task|issue|meeting|document|doc)\s+"([^"]+)"', "name"),  # "create project \"X\""
    ]
    
    # Apply single quote patterns first
    for pattern, field_name in single_quote_patterns:
        match = re.search(pattern, task, re.IGNORECASE)
        if match and field_name not in form_data:
            form_data[field_name] = match.group(1).strip()
    
    # Apply double quote patterns (only if field not already captured)
    for pattern, field_name in double_quote_patterns:
        match = re.search(pattern, task, re.IGNORECASE)
        if match and field_name not in form_data:
            form_data[field_name] = match.group(1).strip()
    
    # Pattern 3: key: value format (without quotes) - more restrictive
    # Only match if followed by 'and', 'with', or end of string
    kv_patterns = [
        (r"name:\s*([^,\n\"']+?)(?:\s+(?:and|with)|$)", "name"),
        (r"title:\s*([^,\n\"']+?)(?:\s+(?:and|with)|$)", "title"),
        (r"description:\s*([^,\n\"']+?)(?:\s+(?:and|with)|$)", "description"),
    ]
    
    for pattern, field_name in kv_patterns:
        if field_name not in form_data:  # Don't override quoted values
            match = re.search(pattern, task, re.IGNORECASE)
            if match:
                value = match.group(1).strip()
                # Clean up common trailing words
                value = re.sub(r'\s+(for|in|on|at)$', '', value, flags=re.IGNORECASE)
                if value and len(value) > 1:
                    form_data[field_name] = value
    
    # Pattern 4: Extract content topic for document creation tasks
    # "with content about X", "containing information about X", "related to X"
    content_patterns = [
        r"(?:with\s+)?content\s+(?:about|on|regarding)\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
        r"containing\s+(?:information|content)\s+(?:about|on)\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
        r"related\s+to\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
        r"document\s+(?:about|on)\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
    ]
    
    for pattern in content_patterns:
        match = re.search(pattern, task, re.IGNORECASE)
        if match and "content_topic" not in form_data:
            topic = match.group(1).strip()
            form_data["content_topic"] = topic
            # Extract keywords from the topic
            keywords = [word.lower() for word in re.findall(r'\b[a-z]{3,}\b', topic.lower())]
            if keywords:
                form_data["content_keywords"] = keywords
            break
    
    # Pattern 5: Extract priority, status, type for project management tasks
    priority_match = re.search(r"(?:with\s+)?priority[:\s]+([a-z]+)", task, re.IGNORECASE)
    if priority_match:
        form_data["priority"] = priority_match.group(1).strip().capitalize()
    
    status_match = re.search(r"(?:with\s+)?status[:\s]+([a-z\s]+)", task, re.IGNORECASE)
    if status_match:
        form_data["status"] = status_match.group(1).strip().capitalize()
    
    type_match = re.search(r"(?:type|kind)[:\s]+([a-z]+)", task, re.IGNORECASE)
    if type_match:
        form_data["type"] = type_match.group(1).strip().capitalize()
    
    # Pattern 6: Extract assignee information
    assignee_patterns = [
        r"assign(?:ed)?\s+to\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
        r"for\s+([A-Za-z\s]+?)(?:\s+and|\.|,|$)",
    ]
    
    for pattern in assignee_patterns:
        match = re.search(pattern, task, re.IGNORECASE)
        if match and "assignee" not in form_data:
            assignee = match.group(1).strip()
            # Make sure it's a reasonable name (not a common word)
            if len(assignee.split()) <= 3 and not any(word in assignee.lower() for word in ["the", "this", "that", "it"]):
                form_data["assignee"] = assignee
                break
    
    return form_data


def normalize_url(url: str) -> str:
    """Normalize a URL by ensuring it has a protocol.
    
    If the URL is missing a protocol (http:// or https://), prepend https://.
    
    Args:
        url: The URL string to normalize.
    
    Returns:
        A normalized URL string with https:// protocol.
    """
    if not url:
        return url
    
    url = url.strip()
    
    # Check if URL already has a protocol
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.scheme in ('http', 'https'):
            return url
    except Exception:
        pass
    
    # Add https:// if missing
    if not url.startswith(('http://', 'https://')):
        url = f"https://{url}"
    
    return url


def generate_url_from_app_name(app_name: str) -> str:
    """Generate a plausible HTTPS URL from an app name.
    
    Converts app names using configurable mappings from config.APP_URL_MAPPINGS.
    Falls back to generic pattern for unknown apps.
    
    Args:
        app_name: The app name (e.g., "TaskManager", "Drive").
    
    Returns:
        A normalized HTTPS URL.
    """
    if not app_name:
        return ""
    
    app_name_lower = app_name.strip().lower()
    
    # Check configurable mappings from config
    if app_name_lower in APP_URL_MAPPINGS:
        return APP_URL_MAPPINGS[app_name_lower]
    
    # For multi-word apps, join with hyphens (e.g., "Google Drive" -> "google-drive.com")
    parts = app_name_lower.split()
    if len(parts) > 1:
        # Try "firstword-secondword.com" pattern
        domain = "-".join(parts)
    else:
        domain = app_name_lower
    
    return f"https://{domain}.com"


def extract_app_and_url(task: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract a web app name and URL from a user task string.

    Heuristics used:
    - If a URL is present, return it as the URL.
    - App name: if the string contains 'on <App>' or 'in <App>' or 'for <App>' patterns
        we capture the following token(s) as the app name.
    - If no explicit app name but a URL exists, derive a friendly name from the hostname.
    - Known apps are recognized case-insensitively anywhere in the task.

    Returns (app_name, url) where either may be None if not found.
    """
    if not task or not isinstance(task, str):
        return None, None

    # List of known app names from config (used for fallback matching)
    known_apps = list(APP_URL_MAPPINGS.keys())

    # Find URL first
    url_match = URL_RE.search(task)
    url = url_match.group("url") if url_match else None

    app_name = None

    # Priority 1: Try to extract an explicit app name using common prepositions
    # e.g., "create a new project in SomeApp" -> captures 'SomeApp'
    # e.g., "apply filter for database in someapp" -> captures 'someapp'
    preposition_re = re.compile(r"(?:in|on|for)\s+([A-Z][\w\-]*(?:\s+[A-Z][\w\-]*)*)")
    prep_match = preposition_re.search(task)
    if prep_match:
        app_name = prep_match.group(1).strip()

    # Priority 2: If no preposition match, search for known app names (case-insensitive) incl. fuzzy tokens
    if not app_name:
        task_lower = task.lower()
        # Direct substring matching first (multi-word apps prioritized by length)
        for known_app in sorted(known_apps, key=len, reverse=True):
            if known_app in task_lower:
                app_name = known_app.title()
                break
        # Fuzzy token matching fallback if still not found
        if not app_name:
            # Strip punctuation and split tokens
            cleaned = re.sub(r"[?!.,:;()]+", " ", task_lower)
            tokens = [t for t in cleaned.split() if t]
            # Generate n-grams up to length 3
            ngrams = []
            for n in (1, 2, 3):
                for i in range(len(tokens) - n + 1):
                    ngrams.append(" ".join(tokens[i:i+n]))
            # Use difflib to find close matches
            candidates = set()
            for fragment in ngrams:
                close = difflib.get_close_matches(fragment, known_apps, n=1, cutoff=0.8)
                if close:
                    candidates.update(close)
            # Prefer multi-word candidate then longest
            if candidates:
                chosen = sorted(candidates, key=lambda c: (len(c.split()), len(c)), reverse=True)[0]
                app_name = chosen.title()

    # Priority 3: Try to derive from URL hostname if present
    if not app_name and url:
        try:
            from urllib.parse import urlparse

            parsed = urlparse(url)
            host = parsed.hostname or ""
            # Strip common subdomains and TLD to get a simple app name
            parts = host.split('.')
            if len(parts) >= 2:
                # remove 'www' or common subdomains
                if parts[0] in ("www", "app", "portal") and len(parts) >= 3:
                    app_name = parts[1]
                else:
                    app_name = parts[0]
            else:
                app_name = host
            # Capitalize for nicer display
            app_name = app_name.replace('-', ' ').title()
        except Exception:
            app_name = None

    # Priority 4: Last resort - don't pick random capitalized words, just return None
    # This prevents "How" from being picked in "How to apply filter..."
    # if not app_name:
    #     cap_re = re.compile(r"\b([A-Z][a-z0-9]{2,30})\b")
    #     cap_match = cap_re.search(task)
    #     if cap_match:
    #         app_name = cap_match.group(1)

    # Normalize LinkedIn variants
    if app_name and app_name.lower() in ("linked", "linked in"):
        app_name = "LinkedIn"

    return app_name, url
