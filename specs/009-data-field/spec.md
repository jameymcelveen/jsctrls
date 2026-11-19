# Feature Specification: DataField

**Feature Branch**: `009-data-field`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: A text control bound to one field of the current DataSet row.

## User Scenarios & Testing

### User Story 1 - Edit the current row in place (Priority: P1)

The user changes the current row's name in a bound field. The field shows the current row, and typing updates the dataset's pending value.

**Why this priority**: The hello world still owns the text box itself. A bound field is the next control.

**Independent Test**: Render a DataField on an open dataset, type, post, and cancel.

**Acceptance Scenarios**:

1. **Given** the current row Ada, **When** the field renders, **Then** it shows Ada.
2. **Given** the user types Augusta, **When** the dataset is editing, **Then** the pending name is Augusta.
3. **Given** the user has typed Augusta, **When** the dataset posts, **Then** the stored name is Augusta.
4. **Given** the user has typed Augusta, **When** the dataset cancels, **Then** the field shows Ada again.

## Requirements

### Functional Requirements

- **FR-001**: DataField reads and writes one field through the DataSet. It does not call a connector.
- **FR-002**: It follows the cursor when the current row changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes in the library BDD suite.

## Assumptions

- Post and cancel stay on the DataSet. The field starts an edit and writes one field. It does not call a connector.
