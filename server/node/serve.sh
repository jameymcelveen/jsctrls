#!/usr/bin/env sh
# Run the Node (TypeScript) names API. SERVER_PORT defaults to 8081.
[ -d node_modules ] || npm ci --silent --omit=dev
exec node src/main.ts
