# Deploying DVAIA on Render

This fork of DVAIA swaps the upstream Ollama/Qdrant stack for a deployment that
fits a single Render web service:

| Concern        | Upstream                         | This fork                                    |
|----------------|----------------------------------|----------------------------------------------|
| LLM backend    | Ollama local models (llama3.2 …) | Anthropic Claude via `ANTHROPIC_API_KEY`     |
| Vector DB      | Separate Qdrant container        | Embedded Qdrant (filesystem-backed)          |
| Embeddings     | Ollama `nomic-embed-text`        | `fastembed` (ONNX, ~80 MB, in-process)       |
| Access control | None (localhost only)            | HTTP basic auth (shared user + password)     |
| Deploy target  | Docker Compose (local)           | Render Docker service + 1 GB persistent disk |

**Intended use:** an intentionally-vulnerable internal lab for authorized AI
security testing. Keep the basic-auth password secret and never attach a real
production secret store to this service.

---

## 1. Get an Anthropic API key

1. Go to <https://console.anthropic.com/settings/keys>.
2. Click **Create Key**, name it (e.g. `dvaia-render`), and copy the value
   (`sk-ant-...`). You will not see it again.
3. Load credits into the workspace under **Plans & Billing** — a few dollars
   is plenty for a lab.

**API-key hygiene**
- Never commit the key to git. `.env` is listed in `.gitignore`; the repo only
  ships `.env.example`.
- On Render, paste the key only into the service **Environment** tab (it is
  stored encrypted). The Render blueprint marks `ANTHROPIC_API_KEY` with
  `sync: false` so it is never written to `render.yaml`.
- Rotate the key immediately if a colleague leaves or a laptop is lost.
- For testing locally, keep the key in your own `.env` file.

---

## 2. Deploy to Render (one-time)

### Option A — Blueprint (recommended)

1. Push this repo to GitHub/GitLab under your own account.
2. In the Render dashboard choose **New +** → **Blueprint** and point it at
   your repo. Render reads `render.yaml` and queues up one web service
   (`dvaia`) with a 1 GB disk.
3. When Render prompts for the two non-synced env vars, fill them in:
   - `ANTHROPIC_API_KEY` — your Claude API key from step 1.
   - `DVAIA_BASIC_AUTH_PASSWORD` — a long random password. Generate one with
     `openssl rand -base64 32`.
4. Click **Apply**. First build takes ~6–8 minutes (Docker image plus the
   fastembed model warm-up). Subsequent deploys are ~1–2 minutes.
5. Render assigns a URL like `https://dvaia-xxxx.onrender.com`. Visit it and
   log in with `dvaia` / your password.

### Option B — Manual web service

Use this if you prefer not to apply the blueprint:

1. **New +** → **Web Service** → connect your repo.
2. **Runtime:** Docker. Render picks up `./Dockerfile` automatically.
3. **Plan:** Starter ($7/mo, 512 MB RAM, 0.5 CPU) works. Free tier works too
   but cold boots are slow and the persistent disk is unavailable.
4. **Health check path:** `/api/health`.
5. **Disk:** add a disk named `dvaia-data`, mount `/var/data`, size `1 GB`.
6. **Environment** tab — add these variables:

   | Key                          | Value                                         |
   |------------------------------|-----------------------------------------------|
   | `ANTHROPIC_API_KEY`          | `sk-ant-...` (your Claude key)                |
   | `DVAIA_BASIC_AUTH_USER`      | `dvaia` (or any username you pick)            |
   | `DVAIA_BASIC_AUTH_PASSWORD`  | long random password                          |
   | `SECRET_KEY`                 | `openssl rand -hex 32` output                 |
   | `DATABASE_URI`               | `/var/data/app.db`                            |
   | `UPLOAD_DIR`                 | `/var/data/uploads`                           |
   | `PAYLOADS_OUTPUT_DIR`        | `/var/data/payloads`                          |
   | `QDRANT_LOCAL_PATH`          | `/var/data/qdrant`                            |
   | `DEFAULT_MODEL`              | `claude-sonnet-4-6` (optional override)       |
   | `AGENTIC_MODEL`              | `claude-sonnet-4-6` (optional override)       |

7. **Create Web Service**. Done.

### Sharing access with colleagues

- They point their browser at the Render URL and enter the basic-auth
  username + password. That's it.
- To rotate access, change `DVAIA_BASIC_AUTH_PASSWORD` in the Render
  dashboard; the service restarts automatically and old sessions are
  invalidated.
- For a stricter posture on a Team/Enterprise plan, add an IP allowlist under
  the service's network settings. The basic-auth gate still applies.

---

## 3. Local development

```bash
cp .env.example .env
# edit .env, set ANTHROPIC_API_KEY (+ optional basic-auth vars)

# with Docker
docker compose up --build

# or without Docker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m api
```

Open <http://127.0.0.1:5000>.

Local dev does **not** require basic auth unless you set
`DVAIA_BASIC_AUTH_USER`/`DVAIA_BASIC_AUTH_PASSWORD` in `.env`.

---

## 4. What changed vs. upstream

- `core/llm.py` — wraps `langchain-anthropic`'s `ChatAnthropic` instead of
  `ChatOllama`; turns `reasoning=True` into Claude's `thinking` param.
- `core/config.py` — drops Ollama settings, adds `get_anthropic_api_key()`.
- `app/embeddings.py` — uses `fastembed` (ONNX, no external service).
- `app/vector_store.py` — embedded Qdrant mode when no `QDRANT_URL` is set.
- `app/config.py` — adds `QDRANT_LOCAL_PATH`, basic-auth env vars.
- `app/agent.py` — parses Claude tool-use + thinking content blocks.
- `api/server.py` — adds a `before_request` gate for HTTP basic auth.
- `Dockerfile`, `docker-compose.yml`, `requirements.txt` — trimmed to match.
- `render.yaml` — new blueprint for Render.

All seven panels (Direct, Document, Web, RAG, Template, Payloads, Agentic)
work on the Render deployment.

---

## 5. Troubleshooting

**"ANTHROPIC_API_KEY is not set" on first request**
: The env var was not saved or the service has not restarted since you added
  it. Open the Render dashboard → service → **Environment** → confirm it
  is there, then **Manual Deploy → Clear cache & redeploy**.

**Basic-auth popup keeps coming back**
: Double-check `DVAIA_BASIC_AUTH_USER` and `DVAIA_BASIC_AUTH_PASSWORD` in
  Render and that there are no stray spaces. Clear your browser's saved
  credential for the URL.

**RAG searches return nothing after a redeploy**
: Confirm `QDRANT_LOCAL_PATH` points at the persistent disk (`/var/data/qdrant`).
  If it points at a non-persistent path, every deploy wipes the collection.

**Cold starts take 20+ seconds**
: Render's Starter plan spins down inactive services. Upgrade to Standard,
  or hit `/api/health` on a cron to keep it warm.

**Agentic panel fails with `parallel_tool_calls` error**
: Extended thinking requires `parallel_tool_calls=false`. The code already
  sets this; if you customized `app/agent.py`, keep that flag intact.
