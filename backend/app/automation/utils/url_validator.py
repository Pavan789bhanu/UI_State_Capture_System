"""URL validation and caching for web applications.

This module ensures correct URLs are used for each web application and caches
validated URLs for future runs.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional, Dict
from datetime import datetime

from app.automation.utils.logger import log


class URLValidator:
    """Validates and caches working URLs for web applications."""
    
    def __init__(self, cache_file: str = ".url_cache.json"):
        """Initialize URL validator with cache file.
        
        Args:
            cache_file: Path to JSON file for caching validated URLs
        """
        self.cache_file = Path(cache_file)
        self.cache: Dict[str, Dict] = self._load_cache()
    
    def _load_cache(self) -> Dict[str, Dict]:
        """Load URL cache from disk."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                log(f"Warning: Could not load URL cache: {e}")
        return {}
    
    def _save_cache(self) -> None:
        """Save URL cache to disk."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            log(f"Warning: Could not save URL cache: {e}")
    
    def get_cached_url(self, app_name: str) -> Optional[str]:
        """Get cached validated URL for an app.
        
        Args:
            app_name: Application name (case-insensitive)
            
        Returns:
            Cached URL if available, None otherwise
        """
        app_key = app_name.lower().strip()
        if app_key in self.cache:
            cached = self.cache[app_key]
            url = cached.get('url')
            last_validated = cached.get('last_validated', 'unknown')
            log(f"Using cached URL for {app_name}: {url} (validated: {last_validated})")
            return url
        return None
    
    def cache_validated_url(self, app_name: str, url: str, status_code: int = 200) -> None:
        """Cache a validated URL for an app.
        
        Args:
            app_name: Application name
            url: Validated URL that successfully loaded
            status_code: HTTP status code from validation
        """
        app_key = app_name.lower().strip()
        self.cache[app_key] = {
            'url': url,
            'status_code': status_code,
            'last_validated': datetime.now().isoformat(),
        }
        self._save_cache()
        log(f"✓ Cached validated URL for {app_name}: {url}")
    
    def validate_url_pattern(self, app_name: str, url: str) -> bool:
        """Validate if a URL seems appropriate for an app.
        
        Checks basic patterns like:
        - Linear should be linear.app domain
        - Notion should be notion.so or notion.com domain
        - GitHub should be github.com domain
        
        Args:
            app_name: Application name
            url: URL to validate
            
        Returns:
            True if URL pattern seems correct for the app
        """
        app_lower = app_name.lower().strip()
        url_lower = url.lower()
        
        # Define expected domain patterns for known apps
        domain_patterns = {
            'linear': ['linear.app'],
            'notion': ['notion.so', 'notion.com'],
            'slack': ['slack.com'],
            'github': ['github.com'],
            'gitlab': ['gitlab.com'],
            'jira': ['atlassian.com', 'atlassian.net'],
            'confluence': ['atlassian.com', 'atlassian.net'],
            'asana': ['asana.com'],
            'trello': ['trello.com'],
            'figma': ['figma.com'],
            'airtable': ['airtable.com'],
            'miro': ['miro.com'],
        }
        
        if app_lower in domain_patterns:
            expected_domains = domain_patterns[app_lower]
            if any(domain in url_lower for domain in expected_domains):
                return True
            else:
                log(f"⚠ URL pattern mismatch for {app_name}!")
                log(f"  URL: {url}")
                log(f"  Expected domains: {', '.join(expected_domains)}")
                return False
        
        # Unknown app - assume URL is OK
        return True
    
    def get_validated_url(self, app_name: str, proposed_url: str) -> str:
        """Get the best URL for an app, preferring cached validated URLs.
        
        Args:
            app_name: Application name
            proposed_url: URL proposed by config or URL generation
            
        Returns:
            Best URL to use (cached if available, otherwise proposed)
        """
        # Check cache first
        cached_url = self.get_cached_url(app_name)
        if cached_url:
            return cached_url
        
        # Validate proposed URL pattern
        if not self.validate_url_pattern(app_name, proposed_url):
            log(f"⚠ Using proposed URL despite pattern mismatch: {proposed_url}")
            log(f"  If this fails, check APP_URL_MAPPINGS in config.py")
        
        return proposed_url
    
    def clear_cache(self, app_name: Optional[str] = None) -> None:
        """Clear URL cache for specific app or all apps.
        
        Args:
            app_name: Application name to clear, or None to clear all
        """
        if app_name:
            app_key = app_name.lower().strip()
            if app_key in self.cache:
                del self.cache[app_key]
                log(f"Cleared URL cache for {app_name}")
        else:
            self.cache = {}
            log("Cleared all URL cache")
        
        self._save_cache()
