# Specs

These specs use the [Spec Kit](https://github.com/github/spec-kit) specification shape: a constitution in `.specify/memory/constitution.md`, one directory per feature, and Gherkin scenarios for anything marked done. The Specify CLI is not required to read or check them.

`pnpm --filter @jsctrls/react test` runs `packages/react/src/bdd/completed.bdd.test.tsx`. That suite executes the library scenarios and fails if a done scenario has no test, or if a draft spec grows a feature file. The names API scenarios run in `server/dotnet` (`dotnet test`) and the Java server (`server/java`, `./mvnw test`).

## Done

| Spec | What |
|---|---|
| [001-scaffold](001-scaffold/spec.md) | Workspace, hello app, Java server |
| [002-connectors](002-connectors/spec.md) | `memoryConnector` and `restConnector` |
| [003-dataset](003-dataset/spec.md) | DataSet state machine |
| [004-binding](004-binding/spec.md) | `useDataSet` |
| [005-controls](005-controls/spec.md) | `TextInput`, `Button`, `ListBox` |
| [006-names-api](006-names-api/spec.md) | Shared names HTTP API |
| [007-hello](007-hello/spec.md) | Hello app add and delete |
| [008-server-selection](008-server-selection/spec.md) | Compose and Make choose a server |

## Draft

| Spec | What |
|---|---|
| [009-data-field](009-data-field/spec.md) | Bound `DataField` |
| [010-data-navigator](010-data-navigator/spec.md) | `DataNavigator` |
| [011-data-grid](011-data-grid/spec.md) | `DataGrid` |
| [012-optimistic-post](012-optimistic-post/spec.md) | Optimistic posts as an option |
| [013-contacts](013-contacts/spec.md) | Contacts example app |
| [014-form-designer](014-form-designer/spec.md) | Drag-and-drop form designer |
| [015-headless-core](015-headless-core/spec.md) | React as a skin over a framework-free core |
