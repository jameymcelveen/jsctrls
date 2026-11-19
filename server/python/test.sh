#!/usr/bin/env sh
set -e
[ -x .venv/bin/pytest ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements-dev.txt; }
exec .venv/bin/pytest -q
