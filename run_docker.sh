#!/bin/bash
# DVAIA - Damn Vulnerable AI Application
# Docker Compose wrapper for local dev.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

if [ ! -f .env ]; then
    echo "ERROR: .env file not found."
    echo "Copy .env.example to .env and set ANTHROPIC_API_KEY before running."
    exit 1
fi

# Export .env so docker compose sees variables
set -a
# shellcheck disable=SC1091
source .env 2>/dev/null || true
set +a

if [ -z "${ANTHROPIC_API_KEY}" ]; then
    echo "ERROR: ANTHROPIC_API_KEY is not set in .env"
    exit 1
fi

echo "Clearing Python cache..."
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

echo "Building and running DVAIA..."
docker compose up --build
