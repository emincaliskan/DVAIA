"""
SQLite schema and helpers. Used by auth, mfa, documents.
"""
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import get_database_uri

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mfa_codes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS backup_codes (
    user_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    extracted_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS secret_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    handler TEXT NOT NULL,
    mission TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def init_db() -> None:
    """Create tables and seed a test user with MFA/backup codes."""
    uri = get_database_uri()
    Path(uri).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(uri)
    try:
        conn.executescript(_SCHEMA)
        _seed_test_user(conn)
        _seed_secret_agents(conn)
        conn.commit()
    finally:
        conn.close()


def _seed_test_user(conn: sqlite3.Connection) -> None:
    """Insert test user (username=test, password=test) and MFA/backup codes if missing."""
    cur = conn.execute(
        "SELECT 1 FROM users WHERE username = ?",
        ("test",),
    )
    if cur.fetchone():
        return
    import hashlib
    password_hash = hashlib.sha256(b"test").hexdigest()
    conn.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        ("test", password_hash, "user"),
    )
    user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute(
        "INSERT OR REPLACE INTO mfa_codes (user_id, code) VALUES (?, ?)",
        (user_id, "123456"),
    )
    for code in ("backup1", "backup2", "backup3"):
        conn.execute(
            "INSERT INTO backup_codes (user_id, code) VALUES (?, ?)",
            (user_id, code),
        )


def _seed_secret_agents(conn: sqlite3.Connection) -> None:
    """Insert example secret agents if table is empty."""
    cur = conn.execute("SELECT 1 FROM secret_agents LIMIT 1")
    if cur.fetchone():
        return
    conn.executemany(
        "INSERT INTO secret_agents (name, handler, mission) VALUES (?, ?, ?)",
        [
            ("Alex Reed", "Shadow", "Infiltrate and assess supply chain security."),
            ("Jordan Blake", "Echo", "Gather intelligence on offshore operations."),
            ("Sam Chen", "Ghost", "Neutralize insider threats before they escalate."),
        ],
    )


def get_connection() -> sqlite3.Connection:
    return sqlite3.connect(get_database_uri())


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Return user row as dict or None."""
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_user(username: str, password_hash: str, role: str = "user") -> int:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )
        conn.commit()
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    finally:
        conn.close()


def list_users() -> List[Dict[str, Any]]:
    """Return all users (id, username, role, created_at). No password hashes."""
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, username, role, created_at FROM users ORDER BY id ASC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_document(document_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        if user_id is not None:
            row = conn.execute(
                "SELECT id, user_id, filename, file_path, extracted_text, created_at FROM documents WHERE id = ? AND user_id = ?",
                (document_id, user_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, user_id, filename, file_path, extracted_text, created_at FROM documents WHERE id = ?",
                (document_id,),
            ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def insert_document(user_id: Optional[int], filename: str, file_path: str, extracted_text: Optional[str] = None) -> int:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO documents (user_id, filename, file_path, extracted_text) VALUES (?, ?, ?, ?)",
            (user_id, filename, file_path, extracted_text),
        )
        conn.commit()
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    finally:
        conn.close()


def update_document_text(document_id: int, extracted_text: str) -> None:
    conn = get_connection()
    try:
        conn.execute("UPDATE documents SET extracted_text = ? WHERE id = ?", (extracted_text, document_id))
        conn.commit()
    finally:
        conn.close()


def delete_document(document_id: int, user_id: Optional[int] = None) -> bool:
    """Delete document row. Returns True if a row was deleted. Caller should remove file from disk first if needed."""
    conn = get_connection()
    try:
        if user_id is not None:
            cur = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user_id))
        else:
            cur = conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def list_documents_by_user(user_id: Optional[int]) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        if user_id is not None:
            rows = conn.execute(
                "SELECT id, user_id, filename, file_path, extracted_text, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, user_id, filename, file_path, extracted_text, created_at FROM documents ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def list_secret_agents() -> List[Dict[str, Any]]:
    """Return all secret agents ordered by created_at."""
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, name, handler, mission, created_at FROM secret_agents ORDER BY created_at ASC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_secret_agent(agent_id: int) -> Optional[Dict[str, Any]]:
    """Return one secret agent by id or None."""
    conn = get_connection()
    try:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, name, handler, mission, created_at FROM secret_agents WHERE id = ?",
            (agent_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def insert_secret_agent(name: str, handler: str, mission: str) -> int:
    """Create a secret agent; returns new id."""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO secret_agents (name, handler, mission) VALUES (?, ?, ?)",
            (name, handler, mission),
        )
        conn.commit()
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    finally:
        conn.close()


def update_secret_agent(agent_id: int, name: str, handler: str, mission: str) -> bool:
    """Update a secret agent; returns True if a row was updated."""
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE secret_agents SET name = ?, handler = ?, mission = ? WHERE id = ?",
            (name, handler, mission, agent_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def delete_secret_agent(agent_id: int) -> bool:
    """Delete a secret agent; returns True if a row was deleted."""
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM secret_agents WHERE id = ?", (agent_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()
