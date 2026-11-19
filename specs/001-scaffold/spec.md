# Feature Specification: Workspace scaffold

**Feature Branch**: `001-scaffold`

**Created**: 2026-11-18

**Status**: Done

**Verified by**: `packages/react/src/bdd/completed.bdd.test.tsx`

**Input**: A pnpm workspace with the library, the hello app, and a Java demo server.

## User Scenarios & Testing

### User Story 1 - Open the repo and find the three parts (Priority: P1)

A developer clones the repo and finds the library, the hello app, and the Java server without hunting.

**Why this priority**: Nothing else builds until the workspace exists.

**Independent Test**: The feature scenario checks that those three paths exist.

**Acceptance Scenarios**:

1. **Given** a checkout of this repo, **When** the developer looks at the tree, **Then** the library, the hello app, and `server/java` are present.

## Requirements

### Functional Requirements

- **FR-001**: The library lives in `packages/core` (framework-free) and `packages/react` (the React skin).
- **FR-002**: The hello app lives in `apps/hello`.
- **FR-003**: The Java server lives in `server/java`, including its Maven build.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The done scenario passes in the library BDD suite.

## Assumptions

- Go and Node server folders are placeholders and are not part of this spec.
