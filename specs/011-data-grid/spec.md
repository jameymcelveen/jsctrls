# Feature Specification: DataGrid

**Feature Branch**: `011-data-grid`

**Created**: 2026-11-18

**Status**: Draft

**Input**: A grid of the dataset rows. The current row is highlighted. Choosing a row moves the cursor.

## User Scenarios & Testing

### User Story 1 - See every row and pick one (Priority: P1)

The user sees the rows in a grid and clicks one to make it current.

**Why this priority**: ListBox shows one field. A grid shows the record.

**Independent Test**: Render a grid, click a row, and read the cursor. Not written yet.

**Acceptance Scenarios**:

1. **Given** three names, **When** the grid renders, **Then** all three are visible and the first is current.
2. **Given** the grid, **When** the user clicks the last row, **Then** that row is current.

## Requirements

### Functional Requirements

- **FR-001**: The grid reads the DataSet snapshot. It does not call a connector.
- **FR-002**: Activating a row calls `locate`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A feature file is added and its scenarios pass before this spec is marked Done.

## Assumptions

- This stays Draft until a feature file and tests exist.
