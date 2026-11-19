#!/usr/bin/env sh
set -e
[ -d node_modules ] || npm ci --silent --include=dev
npm run --silent typecheck
npm test --silent
