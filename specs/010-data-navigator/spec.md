# Feature Specification: DataNavigator

**Feature Branch**: `010-data-navigator`

**Created**: 2026-11-18

**Status**: Draft

**Input**: First, prior, next, last, insert, delete, post, and cancel buttons bound to a DataSet.

## User Scenarios & Testing

### User Story 1 - Move and post without custom buttons (Priority: P1)

The user moves the cursor and posts or cancels an edit from a navigator, the way a Delphi DBNavigator did.

**Why this priority**: The hello app wires Add and Delete by hand.

**Independent Test**: Render a navigator, click next, and see the cursor move. Not written yet.

**Acceptance Scenarios**:

1. **Given** an open dataset on the first row, **When** the user clicks next, **Then** the second row is current.
2. **Given** a pending insert, **When** the user clicks cancel, **Then** the pending value is cleared.

## Requirements

### Functional Requirements

- **FR-001**: The navigator calls DataSet methods only. It does not fetch.
- **FR-002**: Buttons that are illegal in the current state are disabled.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A feature file is added and its scenarios pass before this spec is marked Done.

## Assumptions

- This stays Draft until a feature file and tests exist.
