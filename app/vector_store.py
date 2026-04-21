"""
Qdrant vector store for RAG. Single place for collection create, upsert, search, list.
Uses app.config for QDRANT_URL, QDRANT_COLLECTION, optional QDRANT_API_KEY.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.config import (
    get_qdrant_api_key,
    get_qdrant_collection,
    get_qdrant_local_path,
    get_qdrant_url,
)

_client = None


def _get_client():
    """Lazy init Qdrant client. Uses a running server if QDRANT_URL/HOST is
    set, otherwise falls back to embedded mode (filesystem-backed)."""
    global _client
    if _client is None:
        from qdrant_client import QdrantClient

        url = get_qdrant_url()
        if url:
            _client = QdrantClient(url=url, api_key=get_qdrant_api_key())
        else:
            _client = QdrantClient(path=get_qdrant_local_path())
    return _client


def _collection_name() -> str:
    return get_qdrant_collection()


def reset_collection() -> None:
    """Delete the RAG collection if it exists. Next add will recreate it. Used for RESET_DB_ON_START."""
    try:
        client = _get_client()
        name = _collection_name()
        if client.collection_exists(name):
            client.delete_collection(name)
    except Exception:
        pass


def _ensure_collection(dimension: int) -> None:
    """Create collection if it does not exist. dimension must match embedding size."""
    from qdrant_client.models import Distance, VectorParams

    client = _get_client()
    name = _collection_name()
    if not client.collection_exists(name):
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
        )


def add_point(source: str, content: str, vector: List[float]) -> str:
    """
    Upsert one point into the RAG collection. Creates collection on first use.
    Returns the point id (UUID string).
    """
    if not vector:
        raise ValueError("vector must be non-empty")
    _ensure_collection(len(vector))
    client = _get_client()
    point_id = str(uuid.uuid4())
    from qdrant_client.models import PointStruct

    created_at = datetime.now(timezone.utc).isoformat()
    client.upsert(
        collection_name=_collection_name(),
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload={"source": source, "content": content, "created_at": created_at},
            )
        ],
    )
    return point_id


def search(query_vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Similarity search. Returns list of payload dicts with at least "content".
    Returns empty list if collection does not exist or query fails.
    """
    hits = search_with_scores(query_vector, limit=limit)
    return [{k: v for k, v in h.items() if k != "score"} for h in hits]


def search_with_scores(query_vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Similarity search returning payload dicts plus "score" (similarity).
    Used by search_diverse to take top N per source.
    """
    if not query_vector:
        return []
    try:
        client = _get_client()
        name = _collection_name()
        if not client.collection_exists(name):
            return []
        result = client.query_points(
            collection_name=name,
            query=query_vector,
            with_payload=True,
            with_vectors=False,
            limit=limit,
        )
        out = []
        for p in result.points:
            payload = p.payload or {}
            score = getattr(p, "score", None)
            out.append(
                {
                    "id": p.id,
                    "content": payload.get("content", ""),
                    "source": payload.get("source", ""),
                    "created_at": payload.get("created_at"),
                    "score": score,
                }
            )
        return out
    except Exception:
        return []


def list_all() -> List[Dict[str, Any]]:
    """Return all points as list of dicts: id, source, content, created_at."""
    try:
        client = _get_client()
        name = _collection_name()
        if not client.collection_exists(name):
            return []
        out = []
        offset = None
        while True:
            points, next_offset = client.scroll(
                collection_name=name,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for p in points:
                payload = p.payload or {}
                out.append(
                    {
                        "id": p.id,
                        "source": payload.get("source", ""),
                        "content": payload.get("content", ""),
                        "created_at": payload.get("created_at"),
                    }
                )
            if next_offset is None:
                break
            offset = next_offset
        return out
    except Exception:
        return []


def delete_by_source(source: str) -> None:
    """Delete all points in the RAG collection whose payload source equals the given value."""
    if not (source or str(source).strip()):
        return
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue, FilterSelector

        client = _get_client()
        name = _collection_name()
        if not client.collection_exists(name):
            return
        client.delete(
            collection_name=name,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="source", match=MatchValue(value=source))],
                ),
            ),
        )
    except Exception:
        pass
