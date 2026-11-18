# jsctrls - Cursor starter prompt

Paste everything below the line into Cursor (Agent mode) from an empty `~/dev/jsctrls` folder.

---

You are helping me build **jsctrls**, a React + TypeScript component library whose data layer is **inspired by** Delphi's VCL (TDataSet, TDataSource, data-aware controls). Inspired by, not a copy: modern React and TypeScript idioms win when they conflict with Delphi's. Work in small steps, show me the plan first, and stop after each step so I can review.

## The core idea: four layers, one job each

| Layer | Delphi role it borrows | Job | Knows about |
|---|---|---|---|
| Connector | TConnection / TRESTClient | Talk to a server with CRUD | HTTP only, no state |
| DataSet | TDataSet | Rows, cursor, edit state, loading, errors | The connector, not React |
| Binding | TDataSource | Let React subscribe to a DataSet | The DataSet and React |
| Controls | DB-aware controls | Show and edit data | Only the binding |

**Rule:** a control never talks to the server or the connector. Controls go through the binding; the DataSet decides when to call the connector.

## Layer 1: Connector

```ts
interface Connector<T, K = string> {
  list(query?: Query): Promise<T[]>;
  get(id: K): Promise<T>;
  create(item: Omit<T, "id">): Promise<T>;
  update(id: K, item: Partial<T>): Promise<T>;
  remove(id: K): Promise<void>;
}
```

- `restConnector({ baseUrl, resource, key = "id" })`: GET list, GET one, POST, PATCH, DELETE. Uses `fetch`. Throws a typed `ConnectorError` with status and message on non-2xx.
- `memoryConnector(rows)`: in-memory implementation for tests. Assigns ids on create.
- Support an `AbortSignal` so a newer `list()` can cancel an older one.

## Layer 2: DataSet

Plain TypeScript, no React imports. A small state machine.

- States: `idle`, `loading`, `browse`, `inserting`, `editing`, `posting`, `deleting`, `error`.
- Holds: `rows`, `current` (cursor index / current record), `pending` (the record being edited or inserted), `error`.
- Operations: `open()`, `refresh()`, `first()`, `prior()`, `next()`, `last()`, `locate(id)`, `insert()`, `edit()`, `setField(name, value)`, `post()`, `cancel()`, `delete()`, and the convenience `append(values)` = insert + setField + post.
- `post()` is **pessimistic** for now: call `create` or `update`, then replace the local copy with the server's response (so server-assigned ids flow back). On failure, return to `inserting` / `editing` with `error` set; nothing the user typed is lost.
- `delete()` removes the current record through the connector, then moves the cursor to the next row (or the previous one if it was last). On failure, the row stays and `error` is set.
- Store API for React: `subscribe(listener): () => void` and `getSnapshot(): DataSetSnapshot`. Snapshots are immutable; a new object on every change.
- Guard against overlapping operations (no `post()` while `posting`).

## Layer 3: Binding

- `useDataSet(dataSet)` built on React's `useSyncExternalStore`. Returns the snapshot.
- Optional `DataSetProvider` / `useDataSetContext()` for sharing one DataSet down a tree. Not required for the hello world.

## Layer 4: Controls (hello world set only)

- `TextInput`: plain controlled input. **Unbound** in the hello world.
- `Button`: plain button with a `disabled` prop.
- `ListBox`: bound. Props: `dataSet`, `display` (field to show). Renders the rows, highlights the current record, click or Up/Down arrow keys move the cursor via `locate`. Uses a real listbox pattern (`role="listbox"`, `role="option"`, `aria-selected`) and is keyboard accessible. Shows a quiet "saving..." or "deleting..." state while the DataSet is busy, and the error message if one is set.

## Hello world (the Delphi classic, plus Delete)

An edit box, a list box, an Add button and a Delete button.

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
      <Button disabled={!text.trim() || ds.busy} onClick={async () => { await names.append({ name: text }); setText(""); }}>Add</Button>
      <Button disabled={ds.current == null || ds.busy} onClick={() => names.delete()}>Delete</Button>
      <ListBox dataSet={names} display="name" />
    </>
  );
}
```

- Add posts the new name and clears the edit box on success.
- Delete removes the highlighted item.
- Both buttons disable while the DataSet is busy.

## Demo server (Java + Spring Boot)

A small REST API in Java at `server/`, so the hello world talks to a real HTTP service. It should read like idiomatic, modern Spring.

- Java 21, Spring Boot 3.x, Maven (`./mvnw` wrapper checked in).
- Dependencies: `spring-boot-starter-web`, `spring-boot-starter-validation`, `spring-boot-starter-actuator`, `spring-boot-starter-test`. Nothing else.
- Package layout: `com.jsctrls.demo` with `NameController`, `NameService`, `NameRepository` (interface) + `InMemoryNameRepository` (a `ConcurrentHashMap`), and `Name` / `CreateNameRequest` / `UpdateNameRequest` as Java records.
- Constructor injection only, no field `@Autowired`.
- Routes: `GET /api/names`, `GET /api/names/{id}`, `POST /api/names` (201 + `Location` header), `PATCH /api/names/{id}`, `DELETE /api/names/{id}` (204).
- Validation with `@NotBlank` and `@Size(max = 100)`; names trimmed in the service.
- Errors as RFC 7807 `ProblemDetail` from a `@RestControllerAdvice`: 400 for validation, 404 for missing ids.
- Seeded with three names at startup.
- `demo.delay-ms` property (default 300, overridable with the `DEMO_DELAY_MS` env var) adds latency so the busy states are visible.
- CORS allowed for the Vite dev origin.
- Actuator `GET /actuator/health` for Docker health checks.
- Tests: `@WebMvcTest` + `MockMvc` for every route and error case, plus a plain unit test for `NameService`.

## Docker

- `server/Dockerfile`: multi-stage build (`eclipse-temurin:21-jdk` to build, `eclipse-temurin:21-jre` to run), non-root user.
- `apps/hello/Dockerfile`: builds the Vite app and serves it with nginx, proxying `/api` to the Spring Boot service.
- `docker-compose.yml` at the root with two services, `api` and `web`; `web` depends on `api` being healthy. `docker compose up` brings the whole demo up on http://localhost:8080.
- For day-to-day dev without Docker, Vite's dev server proxies `/api` to `localhost:8081` where `./mvnw spring-boot:run` listens.

## Test doubles

- DataSet and control tests use `memoryConnector`: no network.
- `restConnector` tests mock `fetch` with **MSW (Mock Service Worker)** so they run fast without starting the Java server.

## Tech

- Vite + React 18 + TypeScript (strict). No `any`.
- pnpm workspace: `packages/jsctrls` (library) and `apps/hello` (hello world app).
- Plain CSS with CSS variables (light and dark). No UI framework.
- Vitest + React Testing Library. MSW only for `restConnector` tests.
- Java 21 + Spring Boot 3 for the demo server; `./mvnw test` must pass.
- ESLint + Prettier. A `Makefile` with `make dev` (Spring Boot + Vite together), `make test` (Vitest and `./mvnw test`), `make build`, and `make up` / `make down` for docker compose.
- Ask me before adding any dependency not listed here.

## Steps (stop after each)

1. Scaffold the workspace, both packages and the Spring Boot `server/` folder. These repo files already exist, so keep and extend them rather than replacing them: `Makefile` (its targets assume `pnpm -r lint|typecheck|test|build`, a Vite app named `hello`, and `server/mvnw`), `.editorconfig`, `.gitignore`, `.gitattributes`, `.prettierrc.json`, `.nvmrc`, `.github/workflows/ci.yml`, `.github/dependabot.yml`. Each package needs `lint`, `typecheck`, `test` and `build` scripts. Use ESLint flat config (`eslint.config.js`) with `typescript-eslint` and the React hooks plugin. Show me the file tree first.
2a. The Spring Boot demo server with `MockMvc` tests for every route. Stop.
2b. Connector: the interface, `memoryConnector`, `restConnector`, MSW handlers for its tests. Tests for every CRUD call and for error handling.
3. DataSet: the state machine with tests written first. Cover open, cursor moves, append, post failure keeping the user's input, delete moving the cursor, delete failure, and overlapping-operation guards.
4. Binding: `useDataSet` with `useSyncExternalStore`, plus a test that components re-render on change.
5. Controls: `TextInput`, `Button`, `ListBox` with behavior and keyboard tests.
6. Hello world app wired to the Spring Boot server: Add and Delete working end to end, then Dockerfiles and `docker-compose.yml` so `make up` runs both.
7. README: the four layers, the hello world code, and a "next" list: bound `DataField`, `DataNavigator`, `DataGrid`, optimistic posts as an option, and the Contacts example.
