"""
Document upload and text extraction. Used for document-injection tests.
"""
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import db as app_db
from app.config import get_upload_dir


def save_upload(file_storage: Any, user_id: Optional[int] = None) -> int:
    """
    Save uploaded file to UPLOAD_DIR, insert row in documents, return document_id.
    file_storage: Flask request.files["file"]-like object with .filename and .read().
    """
    upload_dir = get_upload_dir()
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
    filename = file_storage.filename or "unnamed"
    safe_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(upload_dir, safe_name)
    content = file_storage.read()
    with open(file_path, "wb") as f:
        f.write(content)
    extracted = extract_text(file_path)
    return app_db.insert_document(user_id, filename, file_path, extracted)


# Image extensions supported for OCR (Pillow + pytesseract).
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif"}


def extract_text(file_path: str) -> str:
    """Extract text from PDF, docx, plain text, or images (OCR). Returns empty string on failure."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            try:
                import PyPDF2
                with open(file_path, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    parts = []
                    for page in reader.pages:
                        parts.append(page.extract_text() or "")
                    return "\n".join(parts)
            except ImportError:
                return ""
        if suffix in (".docx", ".doc"):
            try:
                import docx
                doc = docx.Document(file_path)
                return "\n".join(p.text for p in doc.paragraphs)
            except ImportError:
                return ""
        if suffix in _IMAGE_SUFFIXES:
            try:
                from PIL import Image
                import pytesseract
                img = Image.open(file_path)
                if img.mode not in ("L", "RGB", "RGBA"):
                    img = img.convert("RGB")
                text = pytesseract.image_to_string(img)
                return (text or "").strip()
            except Exception:
                return ""
        if suffix == ".txt" or not suffix:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        if suffix == ".csv":
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
    except Exception:
        return ""
    return ""


def get_document(document_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Return document metadata and extracted_text. If extracted_text is null or empty, extract and update."""
    row = app_db.get_document(document_id, user_id)
    if not row:
        return None
    current = row.get("extracted_text")
    has_no_text = current is None or (isinstance(current, str) and not current.strip())
    if has_no_text and row.get("file_path"):
        text = extract_text(row["file_path"])
        app_db.update_document_text(document_id, text)
        row["extracted_text"] = text
    return row


def list_documents(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """List documents for user (or all if user_id is None)."""
    return app_db.list_documents_by_user(user_id)


def delete_document(document_id: int, user_id: Optional[int] = None) -> bool:
    """Get document, remove file from disk if present, delete row. Returns True if deleted."""
    row = app_db.get_document(document_id, user_id)
    if not row:
        return False
    file_path = row.get("file_path")
    if file_path and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass
    return app_db.delete_document(document_id, user_id)
