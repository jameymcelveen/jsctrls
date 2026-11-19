#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release --quiet
echo "rust: ok (target/release/names-api)"
