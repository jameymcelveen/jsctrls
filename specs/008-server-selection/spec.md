# Feature Specification: Server selection

**Feature Branch**: `008-server-selection`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: Compose and Make default to the Java server and can select another one.

## User Scenarios & Testing

### User Story 1 - Run a different server without editing Compose (Priority: P1)

`docker compose up` builds `server/java`. `SERVER=dotnet docker compose up` builds `server/dotnet`. Make exposes the same choice.

**Why this priority**: The demo has more than one server, and Java stays the default.

**Independent Test**: The feature scenarios read `docker-compose.yml` and the Makefile.

**Acceptance Scenarios**:

1. **Given** the Compose file, **When** `SERVER` is unset, **Then** the API image is `./server/java`.
2. **Given** the Makefile, **When** the developer sets `SERVER` to java, dotnet, go, or node, **Then** those four names are accepted and unimplemented servers fail the build.

## Requirements

### Functional Requirements

- **FR-001**: Compose defaults the API build to `./server/${SERVER:-java}`.
- **FR-002**: `make up`, `make dev-api`, `make test-api`, and `make build` honor `SERVER`.
- **FR-003**: `make up-java` and `make up-dotnet` select those servers.
- **FR-004**: `SERVER=go` and `SERVER=node` fail with a clear message until those servers exist.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The feature scenarios pass in the library BDD suite.

## Assumptions

- Only Java and .NET have Dockerfiles. Selecting Go or Node must not pretend to build.
