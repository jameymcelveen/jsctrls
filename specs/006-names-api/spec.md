# Feature Specification: Names API

**Feature Branch**: `006-names-api`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `server/dotnet/tests/NamesApiTests.cs`

**Input**: One HTTP contract for every demo server. Java implements it in `server/java`. .NET implements it in `server/dotnet`.

## User Scenarios & Testing

### User Story 1 - The hello app can list, add, and delete names (Priority: P1)

The API stores names, rejects a blank or oversized name, and tells the client where a created name lives.

**Why this priority**: The hello app talks to this and nothing else.

**Independent Test**: The .NET suite calls the API in-process. The Java suite covers the same routes with MockMvc.

**Acceptance Scenarios**:

1. **Given** a fresh server, **When** the client lists names, **Then** the body is Ada, Grace, and Katherine.
2. **Given** the seed, **When** the client gets id 2, **Then** the name is Grace.
3. **Given** an unknown id, **When** the client gets it, **Then** the response is a 404 problem whose detail is `Name not found: missing`.
4. **Given** the name `  Iris  `, **When** the client creates it, **Then** the response is 201, the location contains `/api/names/`, and the stored name is Iris.
5. **Given** a blank name, **When** the client creates it, **Then** the response is a 400 problem whose detail mentions name.
6. **Given** a name of 101 characters, **When** the client creates it, **Then** the response is a 400 problem whose detail mentions name.
7. **Given** id 1, **When** the client patches `  Augusta  `, **Then** the stored name is Augusta.
8. **Given** an unknown id, **When** the client patches it, **Then** the response is a 404 problem.
9. **Given** id 1, **When** the client deletes it, **Then** the response is 204 and a later get is 404.
10. **Given** an unknown id, **When** the client deletes it, **Then** the response is a 404 problem.
11. **Given** the origin `http://localhost:5173`, **When** the client lists names, **Then** the response allows that origin.
12. **Given** a running server, **When** the client gets `/actuator/health`, **Then** the status is UP.

## Requirements

### Functional Requirements

- **FR-001**: `GET /api/names` returns the names sorted by id.
- **FR-002**: `GET /api/names/{id}` returns one name.
- **FR-003**: `POST /api/names` returns 201 and a `Location` containing `/api/names/{id}`.
- **FR-004**: `PATCH /api/names/{id}` replaces the name.
- **FR-005**: `DELETE /api/names/{id}` returns 204.
- **FR-006**: Names are trimmed. A blank name or a name longer than 100 characters is 400 with problem+json, title `Bad Request`.
- **FR-007**: A missing id on get, update, or delete is 404 with problem+json, title `Not Found`, detail `Name not found: {id}`.
- **FR-008**: CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` for GET, POST, PATCH, and DELETE.
- **FR-009**: Each call waits `DEMO_DELAY_MS` milliseconds, default 300. Zero disables the wait.
- **FR-010**: `GET /actuator/health` returns `{"status":"UP"}` so Compose can use one healthcheck.
- **FR-011**: The process listens on `SERVER_PORT` when that variable is set. Local dev uses 8081. Compose uses 8080.

### Key Entities

- **Name**: `id` string and `name` string.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `dotnet test` in `server/dotnet` passes every scenario above.
- **SC-002**: `./mvnw test` in `server/java` passes the same routes.

## Assumptions

- `conformance/names.test.ts` runs these scenarios over plain HTTP against any server: `make conformance SERVER=<name>`. CI runs it against every implemented server, and a new server is done when it passes unchanged.

- Go and Node do not implement this yet. Their folders point here.
- The .NET BDD suite is the feature file's executable check. The Java tests are the original implementation of the same contract.
