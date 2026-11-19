#!/usr/bin/env sh
# Python needs no build step; check that the app imports cleanly.
set -e
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
exec .venv/bin/python -c "import app"
