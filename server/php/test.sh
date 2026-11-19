#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
composer install --quiet --no-interaction
for f in src/*.php public/*.php tests/*.php; do php -l "$f" > /dev/null; done
vendor/bin/phpunit tests
