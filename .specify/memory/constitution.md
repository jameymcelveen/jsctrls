# jsctrls Constitution

## Layers

Controls never talk to the server. Data moves through four layers, in this order:

1. Connector. CRUD over one resource. No cursor and no React.
2. DataSet. Rows, cursor, edit buffer, and state. No React.
3. Binding. React subscribes to a DataSet snapshot with `useSyncExternalStore`.
4. Controls. They read a DataSet. They do not fetch.

Swap the connector and nothing above it changes.

## Skins

React is a skin, not the foundation. Nothing below the binding layer imports React or any other framework, and a lint rule enforces it. Control behavior lives in a headless controller in the core; each skin only renders it.

React component names have no prefix. Web-component tags use the prefix `jc-`. A control's design-time properties live in a `*.meta.ts` file of plain data, and design-time code lives in `*.design.tsx`. Neither ships in runtime code.

## Servers

Every demo server implements the names API in `specs/006-names-api`. Java under `server/java` is the default. A folder with no implementation is not a server.

## Specs

Specs follow the [Spec Kit](https://github.com/github/spec-kit) specification template. A spec marked **Done** has a `spec.feature`, and every scenario in that file is executed by the suite named in the spec. A spec marked **Draft** has no feature file.

## Changes

Do not add a library the current spec did not ask for. Match the code that is already here.
