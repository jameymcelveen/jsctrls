# jsctrls Constitution

## Layers

Controls never talk to the server. Data moves through four layers, in this order:

1. Connector. CRUD over one resource. No cursor and no React.
2. DataSet. Rows, cursor, edit buffer, and state. No React.
3. Binding. React subscribes to a DataSet snapshot with `useSyncExternalStore`.
4. Controls. They read a DataSet. They do not fetch.

Swap the connector and nothing above it changes.

## Servers

Every demo server implements the names API in `specs/006-names-api`. Java under `server/java` is the default. A folder with no implementation is not a server.

## Specs

Specs follow the [Spec Kit](https://github.com/github/spec-kit) specification template. A spec marked **Done** has a `spec.feature`, and every scenario in that file is executed by the suite named in the spec. A spec marked **Draft** has no feature file.

## Changes

Do not add a library the current spec did not ask for. Match the code that is already here.
