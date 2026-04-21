"""
Simulated MFA: verify code, get backup codes. No Flask; API layer passes user_id/code.
"""
from typing import List

from app import db as app_db


def verify_code(user_id: int, code: str) -> bool:
    """Check code against mfa_codes table (or backup_codes)."""
    conn = app_db.get_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM mfa_codes WHERE user_id = ? AND code = ?",
            (user_id, code.strip()),
        ).fetchone()
        if row:
            return True
        row = conn.execute(
            "SELECT 1 FROM backup_codes WHERE user_id = ? AND code = ?",
            (user_id, code.strip()),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def get_backup_codes(user_id: int) -> List[str]:
    """Return list of backup codes for display (can be fed to LLM in indirect tests)."""
    conn = app_db.get_connection()
    try:
        rows = conn.execute(
            "SELECT code FROM backup_codes WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()
