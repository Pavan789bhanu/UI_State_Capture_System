"""Startup validation script for UI Capture System.

Validates that all critical systems are properly configured before startup.
Run before deployment: python backend/scripts/validate_startup.py
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from typing import List, Tuple


class ValidationResult:
    """Store validation results."""
    
    def __init__(self):
        self.passed: List[str] = []
        self.failed: List[Tuple[str, str]] = []
        self.warnings: List[Tuple[str, str]] = []
    
    def add_pass(self, check: str):
        """Add successful check."""
        self.passed.append(check)
        print(f"✓ {check}")
    
    def add_fail(self, check: str, reason: str):
        """Add failed check."""
        self.failed.append((check, reason))
        print(f"✗ {check}: {reason}")
    
    def add_warning(self, check: str, reason: str):
        """Add warning."""
        self.warnings.append((check, reason))
        print(f"⚠ {check}: {reason}")
    
    def print_summary(self):
        """Print validation summary."""
        print("\n" + "="*70)
        print("VALIDATION SUMMARY")
        print("="*70)
        print(f"✓ Passed: {len(self.passed)}")
        print(f"⚠ Warnings: {len(self.warnings)}")
        print(f"✗ Failed: {len(self.failed)}")
        
        if self.warnings:
            print("\nWarnings:")
            for check, reason in self.warnings:
                print(f"  ⚠ {check}: {reason}")
        
        if self.failed:
            print("\nFailed Checks:")
            for check, reason in self.failed:
                print(f"  ✗ {check}: {reason}")
        
        print("="*70)
        
        return len(self.failed) == 0


def validate_environment(result: ValidationResult):
    """Validate environment variables."""
    print("\n--- Environment Variables ---")
    
    # Check SECRET_KEY
    secret_key = os.getenv("SECRET_KEY", "")
    if not secret_key:
        result.add_fail("SECRET_KEY", "Environment variable not set")
    elif len(secret_key) < 32:
        result.add_fail("SECRET_KEY", f"Too short (only {len(secret_key)} chars, need 32+)")
    else:
        result.add_pass(f"SECRET_KEY set ({len(secret_key)} characters)")
    
    # Check OPENAI_API_KEY
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        result.add_fail("OPENAI_API_KEY", "Environment variable not set")
    elif openai_key == "your-openai-key-here":
        result.add_fail("OPENAI_API_KEY", "Still using placeholder value")
    else:
        result.add_pass("OPENAI_API_KEY set")
    
    # Check ENVIRONMENT
    env = os.getenv("ENVIRONMENT", "development")
    if env not in ["development", "staging", "production"]:
        result.add_warning("ENVIRONMENT", f"Unknown value '{env}' (use development/staging/production)")
    else:
        result.add_pass(f"ENVIRONMENT set to '{env}'")
    
    # Check RATE_LIMIT
    rate_limit = os.getenv("RATE_LIMIT_PER_MINUTE")
    if rate_limit:
        try:
            limit = int(rate_limit)
            if limit <= 0:
                result.add_warning("RATE_LIMIT_PER_MINUTE", f"Value {limit} should be positive")
            else:
                result.add_pass(f"RATE_LIMIT_PER_MINUTE set to {limit}")
        except ValueError:
            result.add_warning("RATE_LIMIT_PER_MINUTE", f"Invalid value '{rate_limit}'")
    else:
        result.add_pass("RATE_LIMIT_PER_MINUTE using default (10)")


def validate_imports(result: ValidationResult):
    """Validate that all critical modules can be imported."""
    print("\n--- Module Imports ---")
    
    imports = [
        ("app.main", "FastAPI application"),
        ("app.core.config", "Configuration"),
        ("app.core.encryption", "Password encryption"),
        ("app.utils.ssrf_protector", "SSRF protection"),
        ("app.automation.workflow.loop_detector", "Loop detector"),
        ("app.automation.workflow.completion_checker", "Completion checker"),
        ("app.api.v1.endpoints.auth", "Authentication"),
        ("app.api.v1.endpoints.workflows", "Workflows API"),
        ("app.api.v1.endpoints.executions", "Executions API"),
        ("app.api.v1.endpoints.analytics", "Analytics API"),
    ]
    
    for module_name, description in imports:
        try:
            __import__(module_name)
            result.add_pass(f"Import {description}")
        except ImportError as e:
            result.add_fail(f"Import {description}", str(e))


def validate_configuration(result: ValidationResult):
    """Validate application configuration."""
    print("\n--- Configuration ---")
    
    try:
        from app.core.config import settings
        
        # Validate workflow engine settings
        if hasattr(settings, 'LOOP_DETECTION_WINDOW'):
            result.add_pass(f"LOOP_DETECTION_WINDOW = {settings.LOOP_DETECTION_WINDOW}")
        else:
            result.add_fail("LOOP_DETECTION_WINDOW", "Not configured")
        
        if hasattr(settings, 'MAX_INACTIVITY_SECONDS'):
            result.add_pass(f"MAX_INACTIVITY_SECONDS = {settings.MAX_INACTIVITY_SECONDS}")
        else:
            result.add_fail("MAX_INACTIVITY_SECONDS", "Not configured")
        
        if hasattr(settings, 'MAX_ADAPTIVE_CYCLES'):
            result.add_pass(f"MAX_ADAPTIVE_CYCLES = {settings.MAX_ADAPTIVE_CYCLES}")
        else:
            result.add_fail("MAX_ADAPTIVE_CYCLES", "Not configured")
        
        # Validate SSRF protection settings
        if hasattr(settings, 'BLOCKED_IP_RANGES') and len(settings.BLOCKED_IP_RANGES) > 0:
            result.add_pass(f"BLOCKED_IP_RANGES configured ({len(settings.BLOCKED_IP_RANGES)} ranges)")
        else:
            result.add_fail("BLOCKED_IP_RANGES", "Not properly configured")
        
        if hasattr(settings, 'BLOCKED_URL_SCHEMES') and 'file' in settings.BLOCKED_URL_SCHEMES:
            result.add_pass("BLOCKED_URL_SCHEMES includes dangerous schemes")
        else:
            result.add_fail("BLOCKED_URL_SCHEMES", "Missing file:// scheme protection")
        
    except Exception as e:
        result.add_fail("Configuration loading", str(e))


def validate_security(result: ValidationResult):
    """Validate security features."""
    print("\n--- Security Features ---")
    
    try:
        # Test password encryption
        from app.core.encryption import encrypt_password, decrypt_password
        
        test_pass = "test_password_123"
        encrypted = encrypt_password(test_pass)
        decrypted = decrypt_password(encrypted)
        
        if decrypted == test_pass:
            result.add_pass("Password encryption/decryption working")
        else:
            result.add_fail("Password encryption", "Decryption failed")
    except Exception as e:
        result.add_fail("Password encryption", str(e))
    
    try:
        # Test SSRF protection
        from app.utils.ssrf_protector import SSRFProtector
        
        protector = SSRFProtector()
        
        # Should block localhost
        is_valid, _ = protector.validate_url("http://localhost:8000")
        if not is_valid:
            result.add_pass("SSRF protection blocks localhost")
        else:
            result.add_fail("SSRF protection", "Should block localhost")
        
        # Should allow public URLs
        is_valid, _ = protector.validate_url("https://www.google.com")
        if is_valid:
            result.add_pass("SSRF protection allows public URLs")
        else:
            result.add_fail("SSRF protection", "Should allow public URLs")
        
    except Exception as e:
        result.add_fail("SSRF protection", str(e))


def validate_database(result: ValidationResult):
    """Validate database connection."""
    print("\n--- Database ---")
    
    try:
        from app.core.database import engine, Base
        from sqlalchemy import text
        
        # Try to connect
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result.add_pass("Database connection successful")
        
        # Check if tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['users', 'workflows', 'executions']
        for table in required_tables:
            if table in tables:
                result.add_pass(f"Table '{table}' exists")
            else:
                result.add_warning(f"Table '{table}'", "Not found (will be created on first run)")
        
    except Exception as e:
        result.add_fail("Database connection", str(e))


def validate_dependencies(result: ValidationResult):
    """Validate that all dependencies are installed."""
    print("\n--- Dependencies ---")
    
    dependencies = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("sqlalchemy", "SQLAlchemy"),
        ("pydantic", "Pydantic"),
        ("passlib", "Passlib"),
        ("jose", "Python-JOSE"),
        ("playwright", "Playwright"),
        ("openai", "OpenAI"),
        ("slowapi", "SlowAPI"),
        ("cryptography", "Cryptography"),
    ]
    
    for package, name in dependencies:
        try:
            __import__(package)
            result.add_pass(f"{name} installed")
        except ImportError:
            result.add_fail(f"{name}", f"Package '{package}' not installed")


def main():
    """Run all validation checks."""
    print("="*70)
    print("UI CAPTURE SYSTEM - STARTUP VALIDATION")
    print("="*70)
    
    result = ValidationResult()
    
    # Run all validations
    validate_environment(result)
    validate_dependencies(result)
    validate_imports(result)
    validate_configuration(result)
    validate_security(result)
    validate_database(result)
    
    # Print summary
    is_valid = result.print_summary()
    
    if is_valid:
        print("\n✅ All critical checks passed! System is ready to start.")
        print("\nTo start the system:")
        print("  cd backend && uvicorn app.main:app --reload --port 8000")
        return 0
    else:
        print("\n❌ Some critical checks failed. Please fix the issues above before starting.")
        print("\nCommon fixes:")
        print("  - Set SECRET_KEY: export SECRET_KEY=$(openssl rand -hex 32)")
        print("  - Set OPENAI_API_KEY: export OPENAI_API_KEY='your-key'")
        print("  - Install dependencies: pip install -r requirements.txt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
