# Feature Specification: Controls

**Feature Branch**: `005-controls`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/jsctrls/src/bdd/completed.bdd.test.tsx`

**Input**: `TextInput`, `Button`, and `ListBox`. Controls talk to a DataSet, never to a server.

## User Scenarios & Testing

### User Story 1 - Type, press, and pick a row (Priority: P1)

The user types in an unbound text field, a disabled button does not fire, and the list box moves the cursor by click and arrow keys. While a save or delete is in flight the list says so. A failed delete shows the error.

**Why this priority**: These three controls are the hello world.

**Independent Test**: Render each control and drive it with Testing Library.

**Acceptance Scenarios**:

1. **Given** an empty text field, **When** the user types Iris, **Then** the change handler receives Iris.
2. **Given** a disabled button, **When** the user clicks it, **Then** the click handler does not run.
3. **Given** a list on Ada, **When** the user clicks Grace and presses ArrowDown, **Then** the cursor moves to Grace and then Katherine.
4. **Given** a save in flight, **When** the list renders, **Then** it shows saving. A delete in flight shows deleting. A failed delete shows the error.

## Requirements

### Functional Requirements

- **FR-001**: `TextInput` is uncontrolled by the dataset. The caller owns the value.
- **FR-002**: `Button` defaults `type` to `button` and honors `disabled`.
- **FR-003**: `ListBox` uses `role="listbox"` and `role="option"`, and calls `locate` on click and arrow keys.
- **FR-004**: The list shows `saving...`, `deleting...`, or `loading...` from the dataset state, and the error in an alert.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes in the library BDD suite.

## Assumptions

- Bound `DataField`, `DataNavigator`, and `DataGrid` are separate draft specs.
