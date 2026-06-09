"""Password encryption utilities for secure credential storage."""
from typing import Optional

from cryptography.fernet import Fernet
from app.core.config import settings
import base64
import hashlib


def get_encryption_key() -> bytes:
    """Derive a Fernet-compatible key from SECRET_KEY."""
    # Hash SECRET_KEY to get consistent 32 bytes
    key_hash = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    # Convert to base64 for Fernet (Fernet needs base64-encoded 32 bytes)
    return base64.urlsafe_b64encode(key_hash)


def encrypt_password(password: str) -> str:
    """Encrypt a password using Fernet symmetric encryption.
    
    Args:
        password: Plain text password to encrypt
        
    Returns:
        Encrypted password as string
    """
    if not password:
        return ""
    
    cipher = Fernet(get_encryption_key())
    encrypted = cipher.encrypt(password.encode())
    return encrypted.decode()


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a password encrypted with encrypt_password.
    
    Args:
        encrypted_password: Encrypted password string
        
    Returns:
        Decrypted plain text password
    """
    if not encrypted_password:
        return ""
    
    cipher = Fernet(get_encryption_key())
    decrypted = cipher.decrypt(encrypted_password.encode())
    return decrypted.decode()


def resolve_stored_password(stored: Optional[str]) -> str:
    """Return plaintext for automation, handling encrypted and legacy plaintext values."""
    if not stored:
        return ""
    try:
        return decrypt_password(stored)
    except Exception:
        # Legacy workflows may still have plaintext credentials in the database.
        return stored
