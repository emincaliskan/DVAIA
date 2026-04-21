"""
App-level config from environment. No Flask coupling.
Load .env in api/__main__.py; app reads os.getenv.
"""
import os
from pathlib import Path
from typing import Optional


def get_database_uri() -> str:
    """SQLite path for app DB. Default: project root / data / app.db."""
    uri = os.getenv("DATABASE_URI", "")
    if uri:
        return uri
    root = Path(__file__).resolve().parent.parent
    data = root / "data"
    data.mkdir(exist_ok=True)
    return str(data / "app.db")


def get_secret_key() -> str:
    """Flask SECRET_KEY for sessions. Default: fixed dev key (set in prod)."""
    return os.getenv("SECRET_KEY", "dev-secret-change-in-production")


def get_upload_dir() -> str:
    """Directory for uploaded files. Default: project root / data / uploads."""
    path = os.getenv("UPLOAD_DIR", "")
    if path:
        return path
    root = Path(__file__).resolve().parent.parent
    uploads = root / "data" / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    return str(uploads)


def get_mfa_issuer() -> str:
    """Optional MFA issuer name for display."""
    return os.getenv("MFA_ISSUER", "RedTeamApp")


def get_qdrant_url() -> Optional[str]:
    """
    Qdrant server URL, when using a running Qdrant server.
    Returns None to indicate embedded/local mode (see get_qdrant_local_path).
    """
    host = os.getenv("QDRANT_HOST", "").strip()
    if host:
        port = os.getenv("QDRANT_PORT", "6333").strip()
        return f"http://{host}:{port}"
    url = os.getenv("QDRANT_URL", "").strip()
    return url or None


def get_qdrant_local_path() -> str:
    """
    Filesystem path for embedded Qdrant (used when no server URL is configured).
    Default: project root / data / qdrant. On Render, set QDRANT_LOCAL_PATH to a
    persistent disk path (e.g. /var/data/qdrant) so chunks survive restarts.
    """
    path = os.getenv("QDRANT_LOCAL_PATH", "").strip()
    if path:
        Path(path).mkdir(parents=True, exist_ok=True)
        return path
    root = Path(__file__).resolve().parent.parent
    p = root / "data" / "qdrant"
    p.mkdir(parents=True, exist_ok=True)
    return str(p)


def get_qdrant_collection() -> str:
    """Qdrant collection name for RAG chunks. Default: rag_chunks."""
    return os.getenv("QDRANT_COLLECTION", "rag_chunks").strip()


def get_qdrant_api_key() -> Optional[str]:
    """Optional Qdrant API key (e.g. for Qdrant Cloud)."""
    val = os.getenv("QDRANT_API_KEY", "").strip()
    return val if val else None


def get_login_password() -> Optional[str]:
    """
    Shared password for the login gate. When set, every request requires a
    valid session cookie obtained by entering this password on /login.

    Reads DVAIA_LOGIN_PASSWORD first, then falls back to the legacy
    DVAIA_BASIC_AUTH_PASSWORD env var (the value existing Render deploys
    already have configured). If neither is set, the app refuses to start
    serving protected routes.
    """
    val = os.getenv("DVAIA_LOGIN_PASSWORD", "").strip()
    if val:
        return val
    val = os.getenv("DVAIA_BASIC_AUTH_PASSWORD", "").strip()
    return val or None
