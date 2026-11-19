#!/usr/bin/env bash
# Start one demo server, wait for its health probe, run the conformance suite
# against it, then stop it. Used by `make conformance SERVER=x` and by CI.
set -euo pipefail

server="${1:?usage: conformance/run.sh <server>}"
port="${CONFORMANCE_PORT:-8090}"
root="$(cd "$(dirname "$0")/.." && pwd)"
log="$(mktemp)"

export SERVER_PORT="$port" DEMO_DELAY_MS=0

case "$server" in
  java) (cd "$root/server/java" && exec ./mvnw -B -q spring-boot:run) >"$log" 2>&1 & ;;
  dotnet) (cd "$root/server/dotnet" && exec dotnet run --project src/Jsctrls.Demo.csproj --no-launch-profile) >"$log" 2>&1 & ;;
  *)
    if [ -x "$root/server/$server/serve.sh" ]; then
      (cd "$root/server/$server" && exec ./serve.sh) >"$log" 2>&1 &
    else
      echo "No server named $server (expected server/$server/serve.sh)." >&2
      exit 2
    fi
    ;;
esac
pid=$!
stop() { pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; }
trap stop EXIT

for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$port/actuator/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "The $server server exited before it was healthy. Log:" >&2
    cat "$log" >&2
    exit 1
  fi
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:$port/actuator/health" >/dev/null 2>&1; then
  echo "The $server server was not healthy after 120 seconds. Log:" >&2
  cat "$log" >&2
  exit 1
fi

NAMES_API_URL="http://127.0.0.1:$port" pnpm --dir "$root" --filter conformance conformance
