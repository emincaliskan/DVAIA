"""
LangChain LLM factory: get_llm(model_id) returns a BaseChatModel for simple or agentic use.

Backend: Anthropic Claude (messages API) via langchain-anthropic.
API key is read from ANTHROPIC_API_KEY env var.

Examples of model_id:
  - claude-sonnet-4-6
  - claude-opus-4-7
  - claude-haiku-4-5-20251001
"""
import warnings
from typing import Any, Optional

# Suppress LangChain/Pydantic v1 warning on Python 3.14+ (langchain_core still uses pydantic.v1)
warnings.filterwarnings(
    "ignore",
    message=".*Pydantic V1.*Python 3.14.*",
)

from core.config import (
    get_anthropic_api_key,
    get_default_model_id,
)


def _normalize_model_name(model_id: str) -> str:
    """Strip legacy provider prefixes (e.g. 'ollama:', 'anthropic:') and fall back to a default."""
    if not model_id or not str(model_id).strip():
        return "claude-sonnet-4-6"
    s = str(model_id).strip()
    for prefix in ("anthropic:", "ollama:", "claude:"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):].strip()
            break
    return s or "claude-sonnet-4-6"


def get_llm(
    model_id: Optional[str] = None,
    *,
    timeout: Optional[int] = 120,
    reasoning: bool = False,
    **kwargs: Any,
) -> Any:
    """
    Return a LangChain ChatAnthropic model for the given model_id.

    Uses DEFAULT_MODEL from env when model_id is not passed. `reasoning=True`
    enables Claude extended thinking (CoT) for the agent panel.
    Extra kwargs are passed through to ChatAnthropic (temperature, top_p,
    top_k, max_tokens, ...).
    """
    resolved = (model_id or get_default_model_id()).strip() or get_default_model_id()
    name = _normalize_model_name(resolved)

    api_key = get_anthropic_api_key()
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to .env locally, or set it in "
            "the Render service environment for the deployed app."
        )

    from langchain_anthropic import ChatAnthropic

    # Map Ollama-ish kwargs to their Anthropic equivalents where possible.
    kwargs.pop("repeat_penalty", None)  # no equivalent on Claude
    num_predict = kwargs.pop("num_predict", None)
    if num_predict is not None and "max_tokens" not in kwargs:
        kwargs["max_tokens"] = int(num_predict)
    kwargs.setdefault("max_tokens", 1024)

    if reasoning:
        # Claude extended thinking. Budget must be < max_tokens; thinking forces temperature=1.
        budget = min(4096, max(1024, int(kwargs.get("max_tokens", 4096)) // 2))
        if kwargs.get("max_tokens", 0) <= budget:
            kwargs["max_tokens"] = budget + 1024
        kwargs["thinking"] = {"type": "enabled", "budget_tokens": budget}
        kwargs["temperature"] = 1
        kwargs.pop("top_p", None)
        kwargs.pop("top_k", None)

    return ChatAnthropic(
        model=name,
        api_key=api_key,
        timeout=timeout,
        **kwargs,
    )
