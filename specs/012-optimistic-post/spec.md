# Feature Specification: Optimistic post

**Feature Branch**: `012-optimistic-post`

**Created**: 2026-11-18

**Status**: Draft

**Input**: An option to show a posted row before the server answers, and roll it back if the server rejects it.

## User Scenarios & Testing

### User Story 1 - The row appears immediately (Priority: P2)

With the option on, append shows the new row at once. If the server rejects it, the row disappears and the pending input comes back.

**Why this priority**: The default post is pessimistic and already shipped. This is optional.

**Independent Test**: Append against a connector that answers late, observe the row, then fail the request and observe the rollback. Not written yet.

**Acceptance Scenarios**:

1. **Given** optimistic posts are on, **When** the caller appends, **Then** the row is visible before the connector resolves.
2. **Given** that post then fails, **When** the connector rejects, **Then** the row is gone and the pending input remains.

## Requirements

### Functional Requirements

- **FR-001**: Optimistic behavior is off unless the caller opts in.
- **FR-002**: A rejected optimistic post restores the pre-post snapshot and surfaces the error.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A feature file is added and its scenarios pass before this spec is marked Done.

## Assumptions

- The pessimistic post in `003-dataset` stays the default.
