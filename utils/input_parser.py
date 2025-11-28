import re
import difflib
from typing import Optional, Tuple
from urllib.parse import urlparse

from config import APP_URL_MAPPINGS

URL_RE = re.compile(r"(?P<url>https?://[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)")


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
