"""
Flask API for DVAIA. Thin HTTP layer; delegates to app.*.
Load .env via python -m api (api/__main__.py). PORT, DEFAULT_MODEL, ANTHROPIC_API_KEY.
"""
import hmac
import os
import tempfile
from pathlib import Path

from flask import (
    Flask, request, jsonify, render_template, session, send_from_directory, Response,
)

from core.config import get_agentic_model_id, get_default_model_id

from app import agent as app_agent
from app import auth as app_auth
from app import chat as app_chat
from app import db as app_db
from app import documents as app_documents
from app import mfa as app_mfa
from app import retrieval as app_retrieval
from app.config import (
    get_basic_auth_password,
    get_basic_auth_user,
    get_secret_key,
)
from payloads.config import get_output_dir as get_payloads_output_dir

ROOT = Path(__file__).resolve().parent.parent

app = Flask(__name__, template_folder="templates")
app.config["SECRET_KEY"] = get_secret_key()


@app.before_request
def _require_basic_auth():
    """Gate every request behind HTTP basic auth when credentials are configured.
    /api/health stays open so Render health checks still pass."""
    if request.path == "/api/health":
        return None
    user = get_basic_auth_user()
    password = get_basic_auth_password()
    if not user or not password:
        return None  # auth disabled (local dev)
    auth = request.authorization
    if (
        auth
        and auth.username is not None
        and auth.password is not None
        and hmac.compare_digest(auth.username, user)
        and hmac.compare_digest(auth.password, password)
    ):
        return None
    return Response(
        "Authentication required.\n",
        status=401,
        headers={"WWW-Authenticate": 'Basic realm="DVAIA"'},
    )

# Initialize DB on first use (call once at startup)
_initialized = False


def _ensure_db():
    global _initialized
    if not _initialized:
        app_db.init_db()
        _initialized = True


def _default_model() -> str:
    return get_default_model_id()


def _user_id_from_session():
    return session.get("user_id")


@app.route("/")
def index():
    """Single-page front end: prompt input and output."""
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def api_health():
    """Health check for probes and load balancers."""
    return jsonify({"status": "ok"})


@app.route("/api/models", methods=["GET"])
def api_models():
    """Return model_id format, examples, and agentic (thinking) model for /api/chat and /api/agent/chat."""
    return jsonify({
        "default": _default_model(),
        "agentic_model": get_agentic_model_id(),
        "format": "Use 'model_id' in POST body. Anthropic Claude model IDs (no prefix).",
        "examples": [
            "claude-sonnet-4-6",
            "claude-opus-4-7",
            "claude-haiku-4-5-20251001",
        ],
    })


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Send prompt or messages to model. JSON body:
    - prompt: string (or use "message" if CHAT_REQUEST_BODY_KEY is message); required if messages not set.
    - messages: optional list of {role, content} for multi-turn; if set, used instead of prompt.
    - model_id: optional.
    - options: optional dict for generation (max_tokens, num_predict) to cap output length.
    - context_from, document_id, url, rag_query: for indirect-injection tests.
    """
    _ensure_db()
    data = request.get_json() or {}
    prompt = data.get("prompt") or data.get("message", "")
    messages = data.get("messages")
    model_id = data.get("model_id") or _default_model()
    options = data.get("options")
    context_from = data.get("context_from")
    document_id = data.get("document_id")
    url = data.get("url")
    rag_query = data.get("rag_query")
    if not prompt and not messages:
        return jsonify({"error": "Missing 'prompt' (or 'message') / 'messages' in body"}), 400
    user_id = _user_id_from_session()
    try:
        res = app_chat.handle_chat(
            prompt=prompt,
            user_id=user_id,
            model_id=model_id,
            context_from=context_from,
            document_id=document_id,
            url=url,
            rag_query=rag_query,
            options=options,
            messages=messages,
        )
        return jsonify({"response": res["text"], "thinking": res.get("thinking", "")})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/agent/chat", methods=["POST"])
def api_agent_chat():
    """
    Agentic testing: ReAct agent with SQLite tools. JSON body: prompt, optional model_id,
    messages, tool_names (list), max_steps, timeout.
    Returns response, thinking, messages, tool_calls (names used this turn).
    """
    _ensure_db()
    data = request.get_json() or {}
    prompt = (data.get("prompt") or data.get("message") or "").strip()
    if not prompt:
        return jsonify({"error": "Missing 'prompt' (or 'message') in body"}), 400
    model_id = data.get("model_id") or _default_model()
    messages = data.get("messages")
    if messages is not None and not isinstance(messages, list):
        messages = None
    tool_names = data.get("tool_names")
    if tool_names is not None and not isinstance(tool_names, list):
        tool_names = None
    max_steps = data.get("max_steps")
    if max_steps is not None:
        try:
            max_steps = max(1, min(50, int(max_steps)))
        except (TypeError, ValueError):
            max_steps = 15
    else:
        max_steps = 15
    timeout = data.get("timeout")
    if timeout is not None:
        try:
            timeout = max(10, min(300, int(timeout)))
        except (TypeError, ValueError):
            timeout = 120
    else:
        timeout = 120
    try:
        res = app_agent.run_agent(
            prompt,
            model_id=model_id,
            messages=messages,
            tool_names=tool_names,
            max_steps=max_steps,
            timeout=timeout,
        )
        return jsonify({
            "response": res["text"],
            "thinking": res.get("thinking", ""),
            "messages": res.get("messages", []),
            "tool_calls": res.get("tool_calls", []),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_prompt_from_template(template: str, user_input: str) -> str:
    """Substitute {{user_input}} in template with user_input. No escaping (vulnerable by design)."""
    if not template:
        return user_input
    return template.replace("{{user_input}}", user_input)


@app.route("/api/chat-with-template", methods=["POST"])
def api_chat_with_template():
    """
    Build prompt from template + user_input (substitute {{user_input}}), then send to model.
    JSON body: template, user_input, optional model_id. No escaping—vulnerable for red-team tests.
    """
    _ensure_db()
    data = request.get_json() or {}
    template = data.get("template", "")
    user_input = data.get("user_input", "")
    model_id = data.get("model_id") or _default_model()
    if not template.strip():
        return jsonify({"error": "Missing 'template' in body"}), 400
    user_id = _user_id_from_session()
    constructed = _build_prompt_from_template(template, user_input)
    try:
        res = app_chat.handle_chat(
            prompt=constructed,
            user_id=user_id,
            model_id=model_id,
        )
        return jsonify({
            "response": res["text"],
            "thinking": res.get("thinking", ""),
            "constructed_prompt": constructed
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/login", methods=["POST"])
def api_login():
    """JSON body: username, password. Sets session on success."""
    _ensure_db()
    data = request.get_json() or request.form
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400
    user = app_auth.login(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    session["user_id"] = user["id"]
    session["mfa_verified"] = False
    return jsonify({"ok": True, "user_id": user["id"], "username": user["username"], "role": user["role"]})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """Clear session."""
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/session", methods=["GET"])
def api_session():
    """Return current user if logged in."""
    _ensure_db()
    user_id = _user_id_from_session()
    if not user_id:
        return jsonify({"user": None}), 200
    user = app_auth.get_user_by_id(user_id)
    if not user:
        session.clear()
        return jsonify({"user": None}), 200
    return jsonify({
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "mfa_verified": session.get("mfa_verified", False),
        }
    })


@app.route("/api/mfa", methods=["POST"])
def api_mfa():
    """JSON body: code. Verify MFA and set session.mfa_verified."""
    _ensure_db()
    user_id = _user_id_from_session()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json() or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "Missing code"}), 400
    if not app_mfa.verify_code(user_id, code):
        return jsonify({"error": "Invalid code"}), 401
    session["mfa_verified"] = True
    return jsonify({"ok": True})


@app.route("/api/documents/upload", methods=["POST"])
def api_documents_upload():
    """Multipart: file. Returns document_id."""
    _ensure_db()
    user_id = _user_id_from_session()
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file_storage = request.files["file"]
    if not file_storage or not file_storage.filename:
        return jsonify({"error": "No file selected"}), 400
    try:
        doc_id = app_documents.save_upload(file_storage, user_id)
        return jsonify({"document_id": doc_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/documents", methods=["GET"])
def api_documents_list():
    """List documents for current user (or all if unauthenticated)."""
    _ensure_db()
    user_id = _user_id_from_session()
    docs = app_documents.list_documents(user_id)
    return jsonify({"documents": [{"id": d["id"], "filename": d["filename"], "created_at": d["created_at"]} for d in docs]})


@app.route("/api/documents/<int:document_id>", methods=["GET"])
def api_documents_get(document_id):
    """Get document metadata and extracted text."""
    _ensure_db()
    user_id = _user_id_from_session()
    doc = app_documents.get_document(document_id, user_id)
    if not doc:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "id": doc["id"],
        "filename": doc["filename"],
        "extracted_text": doc.get("extracted_text"),
        "created_at": doc["created_at"],
    })


@app.route("/api/documents/<int:document_id>", methods=["DELETE"])
def api_documents_delete(document_id):
    """Delete document (file and DB row). Requires authenticated session."""
    _ensure_db()
    user_id = _user_id_from_session()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    if not app_documents.delete_document(document_id, user_id):
        return jsonify({"error": "Not found"}), 404
    return jsonify({"ok": True})


@app.route("/api/rag/search", methods=["GET"])
def api_rag_search():
    """Search RAG chunks by keyword. Query params: q, top_k (default 5)."""
    _ensure_db()
    q = (request.args.get("q") or "").strip()
    top_k = min(20, max(1, int(request.args.get("top_k", 5))))
    if not q:
        return jsonify({"chunks": []})
    chunks = app_retrieval.search(q, top_k=top_k)
    return jsonify({"chunks": [{"content": c} for c in chunks]})


@app.route("/api/rag/chunks", methods=["GET"])
def api_rag_chunks_list():
    """List all RAG chunks (id, source, content, created_at)."""
    _ensure_db()
    chunks = app_retrieval.list_chunks()
    return jsonify({"chunks": chunks})


@app.route("/api/rag/chunks", methods=["POST"])
def api_rag_chunks_add():
    """Add a chunk to the RAG index. Body: source (optional), content."""
    _ensure_db()
    data = request.get_json() or {}
    source = (data.get("source") or "").strip() or "manual"
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Missing or empty 'content'"}), 400
    chunk_id = app_retrieval.add_chunk(source, content)
    return jsonify({"id": chunk_id})


@app.route("/api/rag/add-document/<int:document_id>", methods=["POST"])
def api_rag_add_document(document_id):
    """Add a document to RAG: split into chunks, embed each, store. Returns number of chunks added."""
    _ensure_db()
    user_id = _user_id_from_session()
    doc = app_documents.get_document(document_id, user_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    text = (doc.get("extracted_text") or "").strip()
    if not text:
        return jsonify({
            "error": "Document has no extracted text. Use .txt, or install PyPDF2 for PDF, python-docx for DOCX, pytesseract + tesseract-ocr for images.",
        }), 400
    source = doc.get("filename") or f"document_{document_id}"
    chunks_added = app_retrieval.add_document(source, text)
    return jsonify({
        "chunks_added": chunks_added,
        "source": source,
        "content_length": len(text),
    })


@app.route("/api/rag/delete-by-source", methods=["POST"])
def api_rag_delete_by_source():
    """Delete all RAG chunks with the given source. Body: source (string). Requires authenticated session."""
    _ensure_db()
    user_id = _user_id_from_session()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json() or {}
    source = (data.get("source") or "").strip()
    if not source:
        return jsonify({"error": "Missing or empty 'source'"}), 400
    app_retrieval.delete_chunks_by_source(source)
    return jsonify({"ok": True})


@app.route("/evil/")
@app.route("/evil")
def evil_page():
    """Serve malicious page for web-injection tests."""
    evil_dir = Path(__file__).resolve().parent.parent / "app" / "static" / "evil"
    return send_from_directory(str(evil_dir), "index.html")


def _payloads_output_dir():
    """Payloads output directory (resolved)."""
    return Path(get_payloads_output_dir()).resolve()


def _payloads_relative_path(safe_path: Path) -> str:
    """Return path relative to payloads output dir (for list/download). Works when output is container-local."""
    out_dir = _payloads_output_dir()
    try:
        return str(Path(safe_path).resolve().relative_to(out_dir)).replace("\\", "/")
    except ValueError:
        return str(safe_path.name)


def _parse_bool(value):
    """Return True for truthy form/JSON values (true, 1, 'true', '1'), else False."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    return s in ("true", "1", "yes", "on")


def _payloads_generate_data():
    """Build request data from JSON or multipart form. Returns (data, uploaded_file, pdf_file, pdf_metadata_file)."""
    if request.is_json:
        return (request.get_json() or {}), None, None, None
    data = dict(request.form) if request.form else {}
    # Form values are lists for multi-value keys; take first element
    data = {k: (v[0] if isinstance(v, (list, tuple)) else v) for k, v in data.items()}
    files = request.files or {}
    uploaded_file = files.get("file")
    if uploaded_file and not (uploaded_file.filename and uploaded_file.filename.strip()):
        uploaded_file = None
    pdf_file = files.get("payload_pdf_file")
    pdf_metadata_file = files.get("payload_pdf_metadata_file")
    return data, uploaded_file, pdf_file, pdf_metadata_file


@app.route("/api/payloads/generate", methods=["POST"])
def api_payloads_generate():
    """
    Generate a payload asset. JSON body or multipart form: asset_type, plus type-specific options.
    For image, optional form field "file" = uploaded image to modify. Returns { path, relative_path } or 400/500.
    """
    data, uploaded_file, pdf_file, pdf_metadata_file = _payloads_generate_data()
    asset_type = (data.get("asset_type") or "").strip().lower()
    if not asset_type:
        return jsonify({"error": "Missing asset_type"}), 400
    try:
        import payloads
        out_dir = _payloads_output_dir()
        path = None
        if asset_type == "text":
            content = (data.get("content") or "").strip() or "Sample payload text."
            path = payloads.generate_text(content=content, filename=data.get("filename"), subdir=data.get("subdir", "docs"), extension=data.get("extension", "txt"))
        elif asset_type == "pdf":
            text_lines = []
            for i in range(1, 4):
                t = (data.get(f"pdf_line{i}_text") or data.get(f"line{i}_text") or "").strip()
                if t:
                    text_lines.append({
                        "text": t[:80],
                        "font_size": max(8, min(72, int(data.get(f"pdf_line{i}_font_size") or data.get(f"line{i}_font_size") or 12))),
                        "color": (data.get(f"pdf_line{i}_color") or data.get(f"line{i}_color") or "").strip() or None,
                        "alpha": min(255, max(0, int(data.get(f"pdf_line{i}_alpha") or data.get(f"line{i}_alpha") or 255))),
                        "position": (data.get(f"pdf_line{i}_position") or data.get(f"line{i}_position") or "top_left").strip() or "top_left",
                    })
            if not text_lines:
                text_lines = None
            hidden = (data.get("pdf_hidden_content") or data.get("hidden_content") or "").strip() or None
            source_pdf_path = None
            source_file = pdf_file or uploaded_file  # dedicated field or generic "file"
            if source_file:
                fname = (getattr(source_file, "filename", None) or "").strip()
                if not fname or fname.lower().endswith(".pdf"):
                    source_file.seek(0, 2)
                    size = source_file.tell()
                    source_file.seek(0)
                    if size > 10 * 1024 * 1024:
                        return jsonify({"error": "Uploaded PDF too large (max 10 MB)"}), 400
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        source_file.save(tmp.name)
                        source_pdf_path = tmp.name
            try:
                path = payloads.generate_pdf(
                    text_lines=text_lines,
                    hidden_content=hidden,
                    filename=data.get("pdf_filename") or data.get("filename"),
                    subdir=data.get("subdir", "docs"),
                    source_pdf=source_pdf_path,
                )
            finally:
                if source_pdf_path and os.path.isfile(source_pdf_path):
                    try:
                        os.unlink(source_pdf_path)
                    except OSError:
                        pass
        elif asset_type == "pdf_metadata":
            body = (data.get("body_content") or "").strip() or "Document body."
            subject = (data.get("subject") or "").strip()
            author = (data.get("author") or "").strip()
            source_pdf_path = None
            meta_file = pdf_metadata_file or uploaded_file
            if meta_file and (getattr(meta_file, "filename", None) or "").strip().lower().endswith(".pdf"):
                meta_file.seek(0, 2)
                size = meta_file.tell()
                meta_file.seek(0)
                if size > 10 * 1024 * 1024:
                    return jsonify({"error": "Uploaded PDF too large (max 10 MB)"}), 400
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    meta_file.save(tmp.name)
                    source_pdf_path = tmp.name
            try:
                path = payloads.generate_pdf_metadata(
                    body_content=body,
                    subject=subject,
                    author=author,
                    filename=data.get("filename"),
                    subdir=data.get("subdir", "docs"),
                    source_pdf=source_pdf_path,
                )
            finally:
                if source_pdf_path and os.path.isfile(source_pdf_path):
                    try:
                        os.unlink(source_pdf_path)
                    except OSError:
                        pass
        elif asset_type == "csv":
            csv_content = (data.get("csv_content") or "").strip() or None
            csv_columns = (data.get("csv_columns") or "").strip() or None
            num_rows = max(0, min(10000, int(data.get("csv_num_rows") or 10)))
            use_faker = _parse_bool(data.get("csv_use_faker", "true"))
            path = payloads.generate_csv(
                content=csv_content,
                columns=csv_columns,
                num_rows=num_rows,
                filename=data.get("filename"),
                subdir=data.get("subdir", "docs"),
                use_faker=use_faker,
            )
        elif asset_type == "image":
            text_lines = []
            for i in range(1, 4):
                t = (data.get(f"line{i}_text") or data.get(f"text_line{i}") or "").strip()
                if t:
                    text_lines.append({
                        "text": t[:80],
                        "font_size": max(8, min(120, int(data.get(f"line{i}_font_size") or 14))),
                        "color": (data.get(f"line{i}_color") or "").strip() or None,
                        "alpha": min(255, max(0, int(data.get(f"line{i}_alpha") or 255))),
                        "position": (data.get(f"line{i}_position") or "top_left").strip() or "top_left",
                        "low_contrast": _parse_bool(data.get(f"line{i}_low_contrast")),
                        "text_rotation": float(data.get(f"line{i}_text_rotation") or 0),
                        "blur_radius": max(0.0, min(25.0, float(data.get(f"line{i}_blur_radius") or 0))),
                        "noise_level": max(0.0, min(1.0, float(data.get(f"line{i}_noise_level") or 0))),
                    })
            if not text_lines:
                text_lines = None
            position = (data.get("position") or "top_left").strip() or "top_left"
            font_size = max(8, min(120, int(data.get("font_size") or 14)))
            source_image = None
            if uploaded_file:
                # Limit size (e.g. 10 MB); save to temp and pass path
                uploaded_file.seek(0, 2)
                size = uploaded_file.tell()
                uploaded_file.seek(0)
                if size > 10 * 1024 * 1024:
                    return jsonify({"error": "Uploaded image too large (max 10 MB)"}), 400
                ext = Path(uploaded_file.filename).suffix or ".png"
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    uploaded_file.save(tmp.name)
                    source_image = tmp.name
            try:
                path = payloads.generate_image(
                    content=None,
                    width=int(data.get("width") or 400),
                    height=int(data.get("height") or 200),
                    filename=data.get("filename"),
                    subdir=data.get("subdir", "images"),
                    low_contrast=False,
                    background_color=(data.get("background_color") or "").strip() or None,
                    text_color=(data.get("text_color") or "").strip() or None,
                    background_alpha=min(255, max(0, int(data.get("background_alpha", 255)))),
                    text_alpha=min(255, max(0, int(data.get("text_alpha", 255)))),
                    text_rotation=0.0,
                    blur_radius=0.0,
                    noise_level=0.0,
                    source_image=source_image,
                    text_lines=text_lines,
                    position=position,
                    font_size=font_size,
                )
            finally:
                if source_image and os.path.isfile(source_image):
                    try:
                        os.unlink(source_image)
                    except OSError:
                        pass
        elif asset_type == "qr":
            payload = (data.get("payload") or data.get("content") or "").strip() or "https://example.com"
            cw = data.get("composite_width")
            ch = data.get("composite_height")
            path = payloads.generate_qr(payload=payload, filename=data.get("filename"), subdir=data.get("subdir", "images"), composite_width=int(cw) if cw is not None else None, composite_height=int(ch) if ch is not None else None)
        elif asset_type == "audio_synthetic":
            path = payloads.generate_audio_synthetic(duration_sec=float(data.get("duration_sec") or 1.0), frequency=float(data.get("frequency") or 440.0), filename=data.get("filename"), subdir=data.get("subdir", "audio"))
        elif asset_type == "audio_tts":
            text = (data.get("text") or data.get("content") or "").strip() or "Hello world."
            path = payloads.generate_audio_tts(text=text, filename=data.get("filename"), subdir=data.get("subdir", "audio"))
        else:
            return jsonify({"error": f"Unknown asset_type: {asset_type}"}), 400
        if path is None:
            return jsonify({"error": "Generation failed"}), 500
        path = Path(path).resolve()
        if not path.is_file():
            return jsonify({"error": "Generated file not found"}), 500
        relative_path = _payloads_relative_path(path)
        return jsonify({"path": str(path), "relative_path": relative_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/payloads/list", methods=["GET"])
def api_payloads_list():
    """List files under the payloads output directory (safe, no path traversal)."""
    out_dir = _payloads_output_dir()
    if not out_dir.is_dir():
        return jsonify({"files": []})
    files = []
    for p in out_dir.rglob("*"):
        if p.is_file():
            try:
                rel = p.relative_to(out_dir)
                rel_str = str(rel).replace("\\", "/")
                if ".." in rel_str or rel_str.startswith("/"):
                    continue
                files.append({"name": p.name, "relative_path": rel_str, "size": p.stat().st_size})
            except ValueError:
                continue
    files.sort(key=lambda x: (x["relative_path"],))
    return jsonify({"files": files})


@app.route("/api/payloads/file/<path:relative_path>")
def api_payloads_file(relative_path):
    """Serve a file from the payloads output directory. Validates path stays under output (no traversal)."""
    relative_path = (relative_path or "").strip().replace("\\", "/")
    if ".." in relative_path or relative_path.startswith("/"):
        return jsonify({"error": "Invalid path"}), 400
    out_dir = _payloads_output_dir()
    full = (out_dir / relative_path).resolve()
    if not full.is_file():
        return jsonify({"error": "Not found"}), 404
    try:
        full.relative_to(out_dir)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400
    return send_from_directory(str(full.parent), full.name, as_attachment=True, download_name=full.name)


def run_app():
    """Run the Flask app (host/port from env). Called from api/__main__.py."""
    from core.config import get_port
    _ensure_db()
    port = get_port()
    app.run(host="0.0.0.0", port=port)
