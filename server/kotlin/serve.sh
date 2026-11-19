#!/usr/bin/env sh
# Run the Kotlin names API. SERVER_PORT defaults to 8081.
export SERVER_PORT="${SERVER_PORT:-8081}"
exec ./mvnw -B -q compile exec:java
