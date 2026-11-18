# Feature Specification: Hello app

**Feature Branch**: `007-hello`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `apps/hello/src/App.test.tsx`

**Input**: An edit box, a list, Add, and Delete, talking to the names API through the library.

## User Scenarios & Testing

### User Story 1 - Add a name and delete it (Priority: P1)

The user types a name, adds it, sees it selected, and deletes it. The cursor lands on the previous row.

**Why this priority**: This is the demo the rest of the library exists to support.

**Independent Test**: The hello app test stubs fetch and drives Add, then Delete.

**Acceptance Scenarios**:

1. **Given** the seeded names, **When** the user adds Iris and then deletes it, **Then** Iris is gone and Katherine is selected.

## Requirements

### Functional Requirements

- **FR-001**: The app uses `restConnector` against `/api/names` and the library controls.
- **FR-002**: Add is disabled when the text is blank or the dataset is busy.
- **FR-003**: Delete is disabled when there is no current row or the dataset is busy.
- **FR-004**: The text box clears only after a successful add.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The hello app test passes the scenario in `spec.feature`.

## Assumptions

- Vite proxies `/api` to port 8081 during `make dev`. Compose serves the built app on port 8080.
