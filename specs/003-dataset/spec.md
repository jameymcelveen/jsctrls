# Feature Specification: DataSet

**Feature Branch**: `003-dataset`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: A DataSet is a cursor and an edit buffer over a connector. It does not import React.

## User Scenarios & Testing

### User Story 1 - Browse, append, and delete (Priority: P1)

The caller opens a set, moves the cursor, appends a row, and deletes one. A failed post keeps the typed value. A failed delete keeps the row.

**Why this priority**: This is the behavior the controls bind to.

**Independent Test**: The feature scenarios drive `createDataSet` with a memory connector and a connector that fails on demand.

**Acceptance Scenarios**:

1. **Given** two rows, **When** the set opens, **Then** the state is browse and the first row is current.
2. **Given** an open set, **When** the caller locates the second id, **Then** that row is current.
3. **Given** an open set, **When** the caller appends Iris, **Then** Iris is stored and current.
4. **Given** a create that fails, **When** the caller appends, **Then** the set stays inserting and keeps the pending name.
5. **Given** three rows and the middle one current, **When** delete succeeds, **Then** the row that followed it is current.
6. **Given** the last row current, **When** delete succeeds, **Then** the previous row is current.
7. **Given** a delete that fails, **When** the caller deletes, **Then** the row is still there and the error is set.
8. **Given** a post already in flight, **When** the caller posts again, **Then** the second post throws.

## Requirements

### Functional Requirements

- **FR-001**: States include idle, loading, browse, inserting, editing, posting, deleting, and error.
- **FR-002**: `append` inserts, sets fields, and posts.
- **FR-003**: A failed post returns to inserting or editing and keeps the pending input.
- **FR-004**: Delete moves the cursor to the next row, or the previous row when the deleted row was last.
- **FR-005**: A second mutating call while loading, posting, or deleting throws `DataSetError`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes in the library BDD suite.

## Assumptions

- Posts are pessimistic. Optimistic posts are a separate draft spec.
