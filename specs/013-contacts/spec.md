# Feature Specification: Contacts example

**Feature Branch**: `013-contacts`

**Created**: 2026-11-18

**Status**: Draft

**Input**: An example app with more than one field, using the bound controls once they exist.

## User Scenarios & Testing

### User Story 1 - Edit a contact (Priority: P2)

The user opens a contact list, selects one, edits more than one field, and posts.

**Why this priority**: The hello app only stores a name. Contacts shows the controls together.

**Independent Test**: Drive the example the way the hello app test drives Add and Delete. Not written yet.

**Acceptance Scenarios**:

1. **Given** a list of contacts, **When** the user selects one and changes a field, **Then** post stores the change and the list shows it.

## Requirements

### Functional Requirements

- **FR-001**: The example uses the library. It does not call fetch from a control.
- **FR-002**: It depends on the bound field and grid specs, which are still Draft.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A feature file is added and its scenarios pass before this spec is marked Done.

## Assumptions

- This waits on DataField and DataGrid.
