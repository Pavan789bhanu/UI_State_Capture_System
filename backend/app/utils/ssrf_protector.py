"""URL validation to prevent SSRF attacks.

Validates user-provided URLs to block access to internal networks,
localhost, and dangerous URL schemes.
"""

import ipaddress
import re
from typing import Optional
from urllib.parse import urlparse
from app.core.config import settings


class SSRFProtector:
    """Prevent Server-Side Request Forgery (SSRF) attacks via URL validation."""

    def __init__(self):
        """Initialize SSRF protector with blocked ranges from config."""
        self.blocked_ip_ranges = [
            ipaddress.ip_network(cidr) for cidr in settings.BLOCKED_IP_RANGES
        ]
        self.blocked_schemes = settings.BLOCKED_URL_SCHEMES
        self.allowed_schemes = settings.ALLOWED_URL_SCHEMES

    def validate_url(self, url: str) -> tuple[bool, Optional[str]]:
        """Validate URL to prevent SSRF attacks.
        
        Args:
            url: URL to validate
        
        Returns:
            Tuple of (is_valid, error_message):
                - is_valid: True if URL is safe to use
                - error_message: Human-readable error if invalid, None if valid
        """
        if not url or not isinstance(url, str):
            return False, "URL is required and must be a string"
        
        try:
            parsed = urlparse(url)
            
            # Check 1: Validate URL scheme
            if not parsed.scheme:
                return False, "URL must include a scheme (http:// or https://)"
            
            if parsed.scheme.lower() in self.blocked_schemes:
                return False, f"URL scheme '{parsed.scheme}' is not allowed (security risk)"
            
            if parsed.scheme.lower() not in self.allowed_schemes:
                return False, f"URL scheme '{parsed.scheme}' is not supported (use http or https)"
            
            # Check 2: Validate hostname exists
            if not parsed.netloc:
                return False, "URL must include a hostname"
            
            # Check 3: Block localhost variations
            hostname = parsed.netloc.split(':')[0].lower()  # Remove port if present
            localhost_patterns = [
                'localhost',
                '127.0.0.1',
                '0.0.0.0',
                '[::1]',
                '::1',
            ]
            if hostname in localhost_patterns:
                return False, f"Cannot access localhost/loopback addresses ('{hostname}')"
            
            # Check 4: Block internal IP ranges
            try:
                # Try to parse as IP address
                ip = ipaddress.ip_address(hostname.strip('[]'))  # Strip brackets for IPv6
                
                # Check against blocked ranges
                for blocked_range in self.blocked_ip_ranges:
                    if ip in blocked_range:
                        return False, f"Cannot access internal/private IP addresses ({hostname} is in {blocked_range})"
                
            except ValueError:
                # Not an IP address, it's a domain name - that's fine
                # Domain names are allowed (they'll be resolved by the browser)
                pass
            
            # Check 5: Block suspicious domains
            suspicious_tlds = ['.local', '.internal', '.private', '.lan']
            if any(hostname.endswith(tld) for tld in suspicious_tlds):
                return False, f"Cannot access internal domain names ('{hostname}')"
            
            return True, None
            
        except Exception as e:
            return False, f"Invalid URL format: {str(e)}"

    def sanitize_url(self, url: str) -> str:
        """Sanitize URL by ensuring it has a scheme.
        
        Args:
            url: URL to sanitize
        
        Returns:
            Sanitized URL with scheme
        """
        if not url:
            return ""
        
        # Add https:// if no scheme present
        if not re.match(r'^https?://', url, re.IGNORECASE):
            return f"https://{url}"
        
        return url
