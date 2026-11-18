# Feature Specification: Connectors

**Feature Branch**: `002-connectors`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/jsctrls/src/bdd/completed.bdd.test.tsx`

**Input**: A connector moves records. It holds no cursor and knows nothing about React.

## User Scenarios & Testing

### User Story 1 - Read and write records (Priority: P1)

A caller lists, creates, updates, and removes records through one connector.

**Why this priority**: The DataSet has nothing to call without this.

**Independent Test**: Memory-connector scenarios cover each operation and a missing record.

**Acceptance Scenarios**:

1. **Given** a connector holding Ada and Grace, **When** the caller lists records, **Then** both records come back.
2. **Given** an empty connector, **When** the caller creates Iris, **Then** the result has an id and the name Iris.
3. **Given** a stored Ada, **When** the caller updates her name, **Then** a later get returns the new name.
4. **Given** a stored Ada, **When** the caller removes her, **Then** a later get fails with a connector error.
5. **Given** a list call whose signal is already aborted, **When** the caller lists, **Then** the call fails.

## Requirements

### Functional Requirements

- **FR-001**: A connector exposes list, get, create, update, and remove.
- **FR-002**: `create` assigns an id. The caller does not.
- **FR-003**: A missing record throws `ConnectorError`.
- **FR-004**: `list` accepts an `AbortSignal`.

### Key Entities

- **Record**: An object with a string `id` and the caller's other fields.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes in the library BDD suite.

## Assumptions

- The executable scenarios use `memoryConnector`. `restConnector` is covered by its own MSW tests.
