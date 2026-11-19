#!/usr/bin/env sh
# Run the Java names API. SERVER_PORT defaults to 8081.
export SERVER_PORT="${SERVER_PORT:-8081}"
exec ./mvnw -B -q spring-boot:run
