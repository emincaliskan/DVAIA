"""
Fetch URL and return plain text. Used for web-injection tests.
Vulnerable-by-design: no strict SSRF allowlist; document risk in production.
Uses curl_cffi for browser-like TLS (WAF-friendly).
"""
import re
from typing import Optional

try:
    from curl_cffi import requests
except ImportError:
    requests = None  # type: ignore


def fetch_url_to_text(url: str, timeout: int = 10) -> str:
    """
    GET url and return response body as plain text. Strip HTML tags.
    Only http/https allowed.
    """
    if requests is None:
        raise RuntimeError("curl_cffi not installed")
    if not url.startswith(("http://", "https://")):
        return ""
    try:
        r = requests.get(url, timeout=timeout, impersonate="chrome")
        r.raise_for_status()
        text = r.text
    except Exception:
        return ""
    return _strip_html(text)


def _strip_html(html: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
