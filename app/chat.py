"""
Chat orchestration: build context from upload/url/rag, then call core.generate.
"""
from typing import Any, Dict, List, Optional

from core import generate

from app import documents as app_documents
from app import fetch as app_fetch
from app import retrieval as app_retrieval


def handle_chat(
    prompt: str = "",
    user_id: Optional[int] = None,
    model_id: Optional[str] = None,
    context_from: Optional[str] = None,
    document_id: Optional[int] = None,
    url: Optional[str] = None,
    rag_query: Optional[str] = None,
    timeout: int = 120,
    options: Optional[Dict[str, Any]] = None,
    messages: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, str]:
    """
    Build full prompt from optional context (upload, url, rag), then call core.generate.
    - If messages is provided (multi-turn), use that and ignore prompt for the final invoke.
    - options: passed to generate for max_tokens/num_predict to cap output length.
    - context_from == "upload" and document_id: prepend document text.
    - context_from == "url" and url: fetch URL, prepend text.
    - context_from == "rag" and rag_query: search chunks, prepend.
    Otherwise: use prompt only (direct-injection behavior).
    Returns {"text": str, "thinking": str}.
    """
    if messages:
        return generate(messages=messages, model_id=model_id or None, options=options)

    full_prompt = prompt or ""
    if context_from and (document_id is not None or url or rag_query):
        parts = []
        if context_from == "upload" and document_id is not None:
            doc = app_documents.get_document(document_id, user_id)
            if doc and doc.get("extracted_text"):
                parts.append(f"Context from document:\n{doc['extracted_text']}\n")
        if context_from == "url" and url:
            text = app_fetch.fetch_url_to_text(url, timeout=min(30, timeout))
            if text:
                parts.append(f"Context from URL:\n{text}\n")
        if context_from == "rag" and rag_query:
            chunks = app_retrieval.search_diverse(rag_query)
            if chunks:
                parts.append("Context from retrieval:\n" + "\n\n".join(chunks) + "\n")
        if parts:
            full_prompt = "\n".join(parts) + "\nUser question: " + (prompt or "")
    return generate(full_prompt, model_id=model_id or None, options=options)
