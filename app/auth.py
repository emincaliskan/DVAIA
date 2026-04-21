"""
Auth logic: login, password check. No Flask; API layer passes credentials/session.
"""
import hashlib
from typing import Any, Dict, Optional

from app import db as app_db


def hash_password(password: str) -> str:
    """Simple hash for vulnerable-by-design app."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def check_password(password_hash: str, password: str) -> bool:
    return hash_password(password) == password_hash


def login(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Verify credentials and return user dict (id, username, role, ...) or None.
    """
    user = app_db.get_user_by_username(username)
    if not user:
        return None
    if not check_password(user["password_hash"], password):
        return None
    return user


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Return user dict for session lookup."""
    return app_db.get_user_by_id(user_id)
