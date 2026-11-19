#!/usr/bin/env bash
# Run the PHP names API on SERVER_PORT (default 8081).
# PHP's built-in server is one process, and the store is a JSON file, so
# each start resets the file to the three seeded names.
set -euo pipefail
cd "$(dirname "$0")"
[ -d vendor ] || composer install --no-dev --quiet --no-interaction
export NAMES_STORE="${NAMES_STORE:-$(mktemp -d)/names.json}"
exec php -S "0.0.0.0:${SERVER_PORT:-8081}" public/index.php
