#!/usr/bin/env sh
# Run the Python names API. SERVER_PORT defaults to 8081.
set -e
[ -x .venv/bin/uvicorn ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
exec .venv/bin/uvicorn app:app --host 0.0.0.0 --port "${SERVER_PORT:-8081}"
