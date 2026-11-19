#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
composer install --no-dev --quiet --no-interaction --optimize-autoloader
for f in src/*.php public/*.php; do php -l "$f" > /dev/null; done
echo "php: ok"
