# jsctrls

**Data-aware React controls, inspired by Delphi.**

[![CI](https://github.com/jameymcelveen/jsctrls/actions/workflows/ci.yml/badge.svg)](https://github.com/jameymcelveen/jsctrls/actions/workflows/ci.yml)
[![Status: early development](https://img.shields.io/badge/status-early%20development-orange)](#status)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Java 21](https://img.shields.io/badge/Java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org)
[![Spring Boot 3](https://img.shields.io/badge/Spring%20Boot-3-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

Back in the Delphi days, you dropped a data source on a form, pointed a grid and a few edit boxes at it, and the controls just knew how to read, edit, post and cancel. Most React apps rebuild that plumbing by hand in every screen.

jsctrls brings the idea forward. It is **inspired by** Delphi's VCL, not a copy: modern React and TypeScript idioms win wherever the two disagree.

## The idea: four layers, one job each

| Layer | Delphi role it borrows | Job | Knows about |
|---|---|---|---|
| **Connector** | TConnection / TRESTClient | Talk to a server with CRUD | HTTP only, no state |
| **DataSet** | TDataSet | Rows, cursor, edit state, loading, errors | The connector, not React |
| **Binding** | TDataSource | Let React subscribe to a DataSet | The DataSet and React |
| **Controls** | DB-aware controls | Show and edit data | Only the binding |

**React is a skin.** Connectors, the DataSet, and each control's behavior live in `@jsctrls/core`, which imports no UI framework. `@jsctrls/react` renders that behavior with React, and `@jsctrls/elements` renders the same behavior as web components (`<jc-listbox>` today). The `jc-` prefix is named for J.C. Yarborough.

**The one rule:** a control never talks to a server. Controls go through the binding, and the DataSet decides when to call the connector. Swap the connector and nothing above it changes.

```ts
interface Connector<T, K = string> {
  list(query?: Query): Promise<T[]>;
  get(id: K): Promise<T>;
  create(item: Omit<T, "id">): Promise<T>;
  update(id: K, item: Partial<T>): Promise<T>;
  remove(id: K): Promise<void>;
}
```

The DataSet is plain TypeScript with no React inside: a small state machine (`browse`, `inserting`, `editing`, `posting`, `deleting`, `error`) with a cursor, `post` and `cancel`, and errors that never lose what the user typed. React binds to it through `useSyncExternalStore`.

## Hello world

Delphi's classic first program, an edit box, a list box and an Add button, plus Delete:

```tsx
const names = createDataSet<{ id: string; name: string }>({
  connector: restConnector({ baseUrl: "/api", resource: "names" }),
});

function App() {
  const [text, setText] = useState("");
  const ds = useDataSet(names);
  useEffect(() => { names.open(); }, []);
  return (
    <>
      <TextInput value={text} onChange={setText} />
      <Button disabled={!text.trim() || ds.busy}
              onClick={async () => { await names.append({ name: text }); setText(""); }}>
        Add
      </Button>
      <Button disabled={ds.current == null || ds.busy} onClick={() => names.delete()}>
        Delete
      </Button>
      <ListBox dataSet={names} display="name" />
    </>
  );
}
```

## Repository layout

```
packages/core      @jsctrls/core: connectors and DataSet, no framework
packages/react     @jsctrls/react: useDataSet and the React controls
packages/elements  @jsctrls/elements: web-component skins, starting with jc-listbox
apps/hello         the hello world app (served at jsctrls.com/example/)
www                the jsctrls.com landing page, with a live demo of both skins
api                Vercel function: the names API for jsctrls.com
server/<lang>      the demo names API, once per language (see below)
conformance        one HTTP test suite every server must pass
specs              done and draft specs, with feature files for the done ones
docker-compose.yml runs one API and the app. SERVER=java by default
```

## One API, many languages

Every demo server implements the same names API ([spec 006](specs/006-names-api/spec.md)) and must pass the same HTTP [conformance suite](conformance/names.test.ts), unchanged. Each one is written the way that language's community would write it, so the folders double as a side-by-side study.

| Server | Stack | Status |
|---|---|---|
| `java` (default) | Java 21, Spring Boot 3 | passes |
| `dotnet` | .NET 10, minimal APIs | passes |
| `go` | Go, standard library only (`net/http` routing) | passes |
| `node` | TypeScript, Fastify | planned |
| `python` | Python, FastAPI | planned |
| `php` | PHP, Slim | planned |
| `rust` | Rust, axum | planned |
| `kotlin` | Kotlin, Ktor | planned |

Every server folder has the same four entry points: `serve.sh` (runs on `SERVER_PORT`, default 8081), `test.sh` (its native tests), `build.sh`, and a `Dockerfile`. The Makefile, Compose and the conformance runner use only those, so adding a language never touches them.

```sh
make servers                     # which servers exist
make conformance SERVER=go       # start the Go server and run the suite against it
make test-api SERVER=go          # its native tests
```

## Getting started

```sh
make help                  # list every target
make up                    # Java API + app on http://localhost:8080
make up SERVER=dotnet      # same app, .NET API
make dev                   # Spring Boot on :8081 + Vite, no Docker
make dev SERVER=dotnet     # .NET API on :8081 + Vite
make check                 # lint, typecheck, web tests, Java tests, .NET tests
```

`SERVER` picks any implemented server; the others stop with a clear message. `make test` runs the web tests plus the Java and .NET APIs (set `TEST_SERVERS` for more). CI runs every server's native tests and the conformance suite.

## Status

The hello world is in place: an edit box, a list, Add, and Delete, talking to the Spring Boot names API.

- [x] Workspace scaffold, Makefile, lint and test setup
- [x] Spring Boot demo API with `MockMvc` tests
- [x] `memoryConnector` and `restConnector`
- [x] DataSet state machine, test-first
- [x] `useDataSet` binding
- [x] `TextInput`, `Button`, `ListBox`
- [x] Hello world, end to end, with Docker Compose
- [x] Headless core: React as a skin, typed control meta, and the `jc-listbox` web component
- [x] Bound `DataField`
- [x] Bound `DataNavigator`

## What's next

Done and draft work is listed in [`specs/`](specs/README.md).

- `DataGrid`
- Optimistic posts as an option
- A Contacts example app
- Further out: a drag-and-drop form designer, the way Delphi did it

## Author

Built by [Jamey McElveen](https://jameymcelveen.com), a principal software architect who has been building components since the Delphi days.

Copyright (c) 2026 Jamey McElveen
