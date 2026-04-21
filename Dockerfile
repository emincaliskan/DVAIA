# DVAIA - Damn Vulnerable AI Application
# Intentionally vulnerable LLM web application for security testing education.
# Backend: Anthropic Claude (messages API). RAG: embedded Qdrant + fastembed.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

WORKDIR /app

# System deps:
#   fonts-dejavu-core : image/PDF payload rendering
#   tesseract-ocr     : OCR for image Document Injection
#   ffmpeg            : TTS audio payload generation (gTTS + pydub)
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-dejavu-core tesseract-ocr ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python deps first so Docker can cache the layer across rebuilds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download fastembed model into the image to avoid slow cold starts.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

# Application code
COPY . .

# Non-root user (Render expects processes not to require root)
RUN useradd -m agentuser && chown -R agentuser:agentuser /app
USER agentuser

EXPOSE 5000

# Gunicorn: one worker + threads keeps RAM low on Render's 512MB Starter plan.
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "8", "--timeout", "180", "api.server:app"]
