# Feature Specification: Form designer

**Feature Branch**: `014-form-designer`

**Created**: 2026-11-18

**Status**: Draft

**Input**: A drag-and-drop form designer, the way Delphi laid out data-aware controls.

## User Scenarios & Testing

### User Story 1 - Place a field on a form (Priority: P3)

The user drops a bound field onto a form and the running form reads the dataset.

**Why this priority**: This is further out than the controls and the contacts example.

**Independent Test**: Not written yet. A designer session that places a field and shows live data.

**Acceptance Scenarios**:

1. **Given** an empty form, **When** the user drops a field bound to name, **Then** the form shows the current row's name.

## Requirements

### Functional Requirements

- **FR-001**: The designer places library controls. It does not invent a second data path.
- **FR-002**: This does not start until the bound controls exist.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A feature file is added and its scenarios pass before this spec is marked Done.

## Assumptions

- This stays further out than the other draft specs.
