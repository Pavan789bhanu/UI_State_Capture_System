"""Shared pytest fixtures and environment setup for backend tests."""

import os

# Required before app modules import settings singleton
os.environ.setdefault("SECRET_KEY", "test_secret_key_for_ci_must_be_32_chars_long")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key-for-ci-only")
os.environ.setdefault("ENVIRONMENT", "test")
