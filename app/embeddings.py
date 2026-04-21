"""
Embedding service for RAG using fastembed (ONNX, self-contained).
No external LLM runtime is required -- the model is a small ONNX blob that
fastembed downloads on first use (BAAI/bge-small-en-v1.5, ~80MB, 384-dim).
"""
from typing import List

from core.config import get_embedding_model_id

_model = None


def _get_embeddings():
    """Lazy init fastembed model."""
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
        except ImportError as e:
            raise RuntimeError(
                "fastembed is required for RAG embeddings. pip install fastembed"
            ) from e
        _model = TextEmbedding(model_name=get_embedding_model_id())
    return _model


def embed_text(text: str) -> List[float]:
    """Embed a single string; returns list of floats."""
    if not (text or "").strip():
        return []
    m = _get_embeddings()
    vec = next(iter(m.embed([text.strip()])))
    return [float(x) for x in vec.tolist()]


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed multiple strings; returns list of vectors."""
    if not texts:
        return []
    stripped = [t.strip() for t in texts if (t or "").strip()]
    if not stripped:
        return []
    m = _get_embeddings()
    return [[float(x) for x in v.tolist()] for v in m.embed(stripped)]


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity between two vectors. Assumes non-zero."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
