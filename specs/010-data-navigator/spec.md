# Feature Specification: DataNavigator

**Feature Branch**: `010-data-navigator`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: First, prior, next, last, insert, delete, edit, post, cancel, and refresh buttons bound to a DataSet.

## User Scenarios & Testing

### User Story 1 - Move and post without custom buttons (Priority: P1)

The user moves the cursor and posts or cancels an edit from a navigator, the way a Delphi DBNavigator did.

**Why this priority**: The hello app wires Add and Delete by hand.

**Independent Test**: Render a navigator, click next, cancel an insert, and read which buttons are disabled.

**Acceptance Scenarios**:

1. **Given** an open dataset on the first row, **When** the user clicks next, **Then** the second row is current.
2. **Given** a pending insert, **When** the user clicks cancel, **Then** the pending value is cleared.
3. **Given** an open dataset on the first row, **When** the navigator renders, **Then** First and Post are disabled, and Next is disabled during an insert.

## Requirements

### Functional Requirements

- **FR-001**: The navigator calls DataSet methods only. It does not fetch.
- **FR-002**: Buttons that are illegal in the current state are disabled.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes in the library BDD suite.

## Assumptions

- The navigator calls DataSet methods only. Post, delete, and refresh return the dataset promise. The other buttons are synchronous.
- Movement stays inside the rows. Post and cancel are only offered while inserting or editing. Insert, edit, and delete are only offered in browse. Every button is disabled while the dataset is busy.
