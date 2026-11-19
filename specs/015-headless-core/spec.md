# Feature Specification: Headless core

**Feature Branch**: `015-headless-core`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: Keep the library framework-agnostic. React is a skin over a core that does not know React exists, so the controls can later be rendered as web components or by another framework without rewriting the behavior.

## User Scenarios & Testing

### User Story 1 - Use the core without React (Priority: P1)

A developer imports connectors, the DataSet, and control controllers from `@jsctrls/core` in a project that has no React installed, and everything works.

**Why this priority**: This is the boundary every other story depends on. If the core imports React, nothing else in this spec holds.

**Independent Test**: A lint rule bans `react` and `react-dom` imports in the core package, and the core package has no React dependency.

**Acceptance Scenarios**:

1. **Given** the core package, **When** lint runs, **Then** no file imports `react` or `react-dom`.
2. **Given** the core package manifest, **When** it is read, **Then** it lists no React dependency of any kind.

### User Story 2 - One behavior, two skins (Priority: P1)

The ListBox behavior (options, selection, keyboard, busy and error states, ARIA attributes) lives once in a core controller. The React `ListBox` and the `jc-listbox` web component both render from it.

**Why this priority**: It proves a control can change skins without duplicating behavior.

**Independent Test**: The same behaviors pass against the React skin and the web-component skin.

**Acceptance Scenarios**:

1. **Given** a list on Ada, Grace and Katherine, **When** the user clicks Grace and presses ArrowDown in the React ListBox, **Then** Katherine is selected.
2. **Given** the same list, **When** the user does the same in `jc-listbox`, **Then** Katherine is selected.

### User Story 3 - Describe a control with plain data (Priority: P2)

Each control publishes its design-time properties in a meta file: plain TypeScript data, type-checked against the control's props, never shipped in runtime code.

**Why this priority**: The form designer (spec 014) reads these files. They are also the `@types`-style fallback for controls that ship no meta of their own.

**Independent Test**: A meta file that names a prop the control does not have fails the typecheck, and the runtime entry points import no meta file.

**Acceptance Scenarios**:

1. **Given** the ListBox meta, **When** it is loaded, **Then** it names the tag `jc-listbox` and marks `dataSet` as bound to a DataSet.
2. **Given** the runtime entry points of core and react, **When** their imports are followed, **Then** no `*.meta.ts` file is reached.

## Requirements

### Functional Requirements

- **FR-001**: Three packages. `@jsctrls/core` holds connectors, the DataSet, headless control controllers, and control meta, with zero framework imports. `@jsctrls/react` holds `useDataSet`, `DataSetProvider`, the React controls, and styles, and depends on core. `@jsctrls/elements` holds web-component skins and starts with one canary, `jc-listbox`.
- **FR-002**: File convention per control:
  - core `controls/ListBox.ts`: the headless controller. Optional; a control with no behavior of its own has none.
  - core `controls/ListBox.meta.ts`: published properties, plain data.
  - react `controls/ListBox.tsx`: the React skin.
  - react `controls/ListBox.design.tsx`: custom design-time UI. Rare; none exist yet.
- **FR-003**: React component names have no prefix (`ListBox`). Web-component tags use the prefix `jc-` (`jc-listbox`), because a custom element name must contain a hyphen and tags share one global namespace. The tag name lives in the meta file. The `jc` prefix is named for J.C. Yarborough.
- **FR-004**: Meta files are written as `export default { ... } satisfies ControlMeta<Props>`, so a property the control does not have fails the typecheck. Meta is exported only from `@jsctrls/core/meta`.
- **FR-005**: Meta and design files never ship in runtime code. A test fails if a runtime entry point imports one.
- **FR-006**: Public API names do not change. Only import paths change.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every scenario in `spec.feature` passes before this spec is marked Done.
- **SC-002**: Every scenario of specs 001 to 008 still passes after the split.

## Assumptions

- The web-component canary uses a plain custom element: no Stencil, no Lit, no shadow DOM. If keeping it alive gets hard, the core boundary has leaked.
- React stays the first and main skin. Other framework adapters are added only when someone needs one.
