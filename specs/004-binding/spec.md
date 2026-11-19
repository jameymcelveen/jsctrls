# Feature Specification: Binding

**Feature Branch**: `004-binding`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: React reads a DataSet through `useDataSet`, which uses `useSyncExternalStore`.

## User Scenarios & Testing

### User Story 1 - The screen follows the cursor (Priority: P1)

A component showing the current row updates when the cursor moves, without the component calling the connector.

**Why this priority**: Controls are useless if they render a stale snapshot.

**Independent Test**: Render a probe, move the cursor, and read the new text.

**Acceptance Scenarios**:

1. **Given** a rendered current-row probe on Ada, **When** the cursor moves to Grace, **Then** the probe shows Grace.

## Requirements

### Functional Requirements

- **FR-001**: `useDataSet` subscribes with `useSyncExternalStore`.
- **FR-002**: The hook returns the dataset snapshot and re-renders on change.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The feature scenario passes in the library BDD suite.

## Assumptions

- `DataSetProvider` is optional. The hello app does not require it.
