"""
Entry point for the red-team API. Loads .env then runs the Flask app.
  python -m api
"""
import os
import shutil
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    _env = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(_env)


def _reset_db_and_uploads():
    """Remove DB file and uploads directory so next start gets a clean slate. Used when RESET_DB_ON_START=1."""
    from app.config import get_database_uri, get_upload_dir
    db_path = Path(get_database_uri())
    if db_path.is_file():
        db_path.unlink()
    upload_path = Path(get_upload_dir())
    if upload_path.is_dir():
        shutil.rmtree(upload_path)


def _reset_rag():
    """Clear the RAG vector collection so each Docker start is fresh. Used when RESET_DB_ON_START=1."""
    try:
        from app import vector_store as app_vector_store
        app_vector_store.reset_collection()
    except Exception:
        pass


if __name__ == "__main__":
    if os.getenv("RESET_DB_ON_START") == "1":
        _reset_db_and_uploads()
        _reset_rag()
    from api.server import run_app
    run_app()
