# Go server

Not implemented.

The contract is `specs/006-names-api`. When this server exists it must serve that API, listen on `SERVER_PORT` (8080 in Compose, 8081 for local dev), and answer `GET /actuator/health` with `{"status":"UP"}`.

`make up SERVER=go` fails until then. Compose defaults to `server/java`.
