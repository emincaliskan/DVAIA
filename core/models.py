"""
Model router: generate(prompt, model_id) -> Anthropic Claude (messages API).

Uses LangChain ChatAnthropic under the hood (core.llm.get_llm) so simple chat
and agentic tool-use flows share one stack. model_id is a Claude model name
(e.g. "claude-sonnet-4-6"). Legacy "ollama:..." prefixes are stripped silently.
"""
from __future__ import annotations

import warnings
from typing import Any, Dict, List, Optional

# Suppress LangChain/Pydantic v1 warning on Python 3.14+ (before first langchain import)
warnings.filterwarnings(
    "ignore",
    message=".*Pydantic V1.*Python 3.14.*",
)

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from core.config import DEFAULT_MODEL
from core.llm import get_llm


def _options_to_llm_kwargs(options: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Map UI sampling options to ChatAnthropic kwargs. Unsupported Ollama-only
    fields (repeat_penalty) are dropped. num_predict is mapped to max_tokens."""
    if not options:
        return {}
    out: Dict[str, Any] = {}
    num = options.get("max_tokens") or options.get("num_predict")
    if num is not None:
        try:
            out["max_tokens"] = int(num)
        except (TypeError, ValueError):
            pass
    if "temperature" in options and options["temperature"] is not None:
        try:
            # Claude caps temperature at 1.0 (Ollama allowed 0..2).
            out["temperature"] = max(0.0, min(1.0, float(options["temperature"])))
        except (TypeError, ValueError):
            pass
    if "top_k" in options and options["top_k"] is not None:
        try:
            out["top_k"] = int(options["top_k"])
        except (TypeError, ValueError):
            pass
    if "top_p" in options and options["top_p"] is not None:
        try:
            out["top_p"] = max(0.0, min(1.0, float(options["top_p"])))
        except (TypeError, ValueError):
            pass
    return out


def _messages_to_lc(messages: List[Dict[str, str]]) -> List[BaseMessage]:
    """Convert [{"role": "user", "content": "..."}, ...] to LangChain message list."""
    lc: List[BaseMessage] = []
    for m in messages:
        role = (m.get("role") or "user").strip().lower()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            lc.append(SystemMessage(content=content))
        elif role == "assistant":
            lc.append(AIMessage(content=content))
        else:
            lc.append(HumanMessage(content=content))
    return lc


def generate(
    prompt: Optional[str] = None,
    model_id: Optional[str] = DEFAULT_MODEL,
    options: Optional[Dict[str, Any]] = None,
    messages: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, str]:
    """
    Send prompt or messages to Claude (Anthropic) via LangChain ChatAnthropic.
    - prompt: single turn (optional if messages is set).
    - messages: multi-turn list of {role, content}; used instead of prompt when set.
    - options: generation options (max_tokens, temperature, top_k, top_p).
    Returns {"text": str, "thinking": ""} (extended thinking is surfaced by the
    agentic panel, not the plain chat panels).
    """
    model_id = model_id or DEFAULT_MODEL

    llm_kwargs = _options_to_llm_kwargs(options)
    llm = get_llm(model_id, **llm_kwargs)

    if messages:
        lc_messages = _messages_to_lc(messages)
        if not lc_messages:
            return {"text": "No text returned.", "thinking": ""}
        msg = llm.invoke(lc_messages)
    else:
        prompt = prompt or ""
        msg = llm.invoke([HumanMessage(content=prompt)])

    raw = getattr(msg, "content", None)
    if isinstance(raw, list):
        # Claude sometimes returns a list of content blocks; concatenate text blocks.
        text = "".join(
            (b.get("text", "") if isinstance(b, dict) and b.get("type") == "text" else "")
            for b in raw
        )
    else:
        text = raw or ""
    text = (text if isinstance(text, str) else "").strip() or "No text returned."

    return {"text": text, "thinking": ""}
