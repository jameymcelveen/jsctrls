#!/usr/bin/env sh
# Node runs TypeScript directly, so the build is install + typecheck.
set -e
npm ci --silent --include=dev
exec npm run --silent typecheck
