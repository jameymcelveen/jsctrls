#!/usr/bin/env bash
# Run the Rust names API on SERVER_PORT (default 8081).
set -euo pipefail
cd "$(dirname "$0")"
export SERVER_PORT="${SERVER_PORT:-8081}"
exec cargo run --release --quiet
