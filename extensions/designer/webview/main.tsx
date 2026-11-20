import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  createDataSet,
  ListBox,
  memoryConnector,
  TextInput,
  useDataSet,
} from "@jsctrls/react";
import type { DataSet } from "@jsctrls/react";
import { controls } from "@jsctrls/core/meta";
import type { ControlCategory, PublishedProperty } from "@jsctrls/core/meta";
import "@jsctrls/react/styles.css";
import "./designer.css";
import type { ControlName, PropValue } from "../src/edits";
import type { DesignDataSet, DesignHandler, DesignNode, DesignProp } from "../src/model";
import type { HostMessage, WebviewMessage } from "../src/protocol";

declare function acquireVsCodeApi(): { postMessage(message: WebviewMessage): void };
const vscode = acquireVsCodeApi();

/** One row of the structure DataSet: a node plus its indented label. */
type Row = DesignNode & { label: string };

function toRows(nodes: readonly DesignNode[]): Row[] {
  return nodes.map((node) => ({
    ...node,
    label:
      "  ".repeat(node.depth) +
      (node.kind === "locked" ? `[locked] ${node.name.slice(0, 40)}` : node.name),
  }));
}

interface Model {
  version: number;
  component: string | null;
  rows: Row[];
  fileName: string;
  canvasUrl: string;
  dataSets: readonly DesignDataSet[];
  handlers: readonly DesignHandler[];
}

/** Every message that changes the file, minus the version, which `send` adds. */
type Operation = Exclude<WebviewMessage, { type: "ready" } | { type: "reveal" }>;
type OperationInput = Operation extends infer M
  ? M extends Operation
    ? Omit<M, "version">
    : never
  : never;

/** What the inspector and palette need to change the file. */
interface Editor {
  send(operation: OperationInput): void;
  reveal(offset: number): void;
  dataSets: readonly DesignDataSet[];
  handlers: readonly DesignHandler[];
}

type CanvasMessage =
  | { source: "jsctrls-canvas"; type: "select"; src: string }
  | { source: "jsctrls-canvas"; type: "ready" };

function App() {
  const [model, setModel] = useState<Model>();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dataSetRef = useRef<DataSet<Row> | null>(null);
  const fileNameRef = useRef<string | null>(null);
  const versionRef = useRef(0);
  // Start offset of an element to select once the next model's DataSet opens.
  const pendingSelect = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage | CanvasMessage>) => {
      const message = event.data;
      if ("source" in message) {
        if (message.source === "jsctrls-canvas" && message.type === "select") {
          // "<file>#<offset>" names a JSX element. Select it when it is in this file.
          const hash = message.src.lastIndexOf("#");
          const file = message.src.slice(0, hash);
          const start = Number(message.src.slice(hash + 1));
          const dataSet = dataSetRef.current;
          const row = dataSet?.getSnapshot().rows.find((candidate) => candidate.start === start);
          if (file !== fileNameRef.current) {
            setNotice(`That element is in ${file.split("/").pop() ?? file}, not this file.`);
          } else if (dataSet && row) {
            setNotice(null);
            dataSet.locate(row.id);
          }
        }
        return;
      }
      if (message.type === "model") {
        fileNameRef.current = message.fileName;
        versionRef.current = message.version;
        pendingSelect.current = message.select;
        setModel({
          version: message.version,
          component: message.component,
          rows: toRows(message.nodes),
          fileName: message.fileName,
          canvasUrl: message.canvasUrl,
          dataSets: message.dataSets,
          handlers: message.handlers,
        });
      } else {
        setError(message.message);
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // A fresh DataSet per model, so the structure list always shows the file as it is now.
  const dataSet = useMemo(
    () => (model ? createDataSet<Row>({ connector: memoryConnector(model.rows) }) : null),
    [model],
  );
  useEffect(() => {
    dataSetRef.current = dataSet;
    if (!dataSet) {
      return;
    }
    void dataSet.open().then(() => {
      const rows = dataSet.getSnapshot().rows;
      const inserted = rows.find((row) => row.start === pendingSelect.current);
      pendingSelect.current = undefined;
      const keep = inserted?.id ?? (rows.some((row) => row.id === selectedId) ? selectedId : null);
      if (keep) {
        dataSet.locate(keep);
      }
    });
    // selectedId is read once per new DataSet on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet]);

  const editor = useMemo<Editor>(
    () => ({
      send(operation) {
        setError(null);
        vscode.postMessage({ ...operation, version: versionRef.current } as WebviewMessage);
      },
      reveal(offset) {
        vscode.postMessage({ type: "reveal", offset });
      },
      dataSets: model?.dataSets ?? [],
      handlers: model?.handlers ?? [],
    }),
    [model],
  );

  if (!model || !dataSet) {
    return <p className="designer-empty">Reading the file.</p>;
  }
  if (model.rows.length === 0) {
    return <p className="designer-empty">No component with JSX was found in this file.</p>;
  }
  return (
    <div className="designer">
      <Palette dataSet={dataSet} editor={editor} />
      <section className="designer-panel designer-structure" aria-label="Structure">
        <h2>Structure: {model.component}</h2>
        <ListBox dataSet={dataSet} display="label" />
      </section>
      <Canvas dataSet={dataSet} fileName={model.fileName} url={model.canvasUrl} notice={notice} />
      <Inspector dataSet={dataSet} editor={editor} onSelect={setSelectedId} />
      {error ? (
        <p className="designer-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const categories: readonly ControlCategory[] = ["Standard", "Data-aware", "Layout", "Non-visual"];

/** The component palette: click a control to add it to the selected element. */
function Palette({ dataSet, editor }: { dataSet: DataSet<Row>; editor: Editor }) {
  const node = useDataSet(dataSet).current;
  const anchor = node && node.kind === "element" ? node.start : null;
  return (
    <section className="designer-panel designer-palette" aria-label="Palette">
      <h2>Palette</h2>
      <div className="designer-palette-groups">
        {categories.map((category) => {
          const members = controls.filter((meta) => meta.category === category);
          if (members.length === 0) {
            return null;
          }
          return (
            <div
              key={category}
              className="designer-palette-group"
              role="group"
              aria-label={category}
            >
              <span className="designer-palette-label">{category}</span>
              {members.map((meta) => (
                <Button
                  key={meta.name}
                  title={`Add a ${meta.name} ${node ? `to ${node.name}` : "to the form"}`}
                  onClick={() => {
                    editor.send({ type: "insert", anchor, control: meta.name as ControlName });
                  }}
                >
                  {meta.name}
                </Button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="designer-note">
        Click a control to add it inside the selected container, or after the selected control.
      </p>
    </section>
  );
}

/** The running app, from its dev server, with the jsctrls design overlay. */
function Canvas({
  dataSet,
  fileName,
  url,
  notice,
}: {
  dataSet: DataSet<Row>;
  fileName: string;
  url: string;
  notice: string | null;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const node = useDataSet(dataSet).current;
  const src = node && node.kind === "element" ? `${fileName}#${node.start}` : null;

  useEffect(() => {
    const onMessage = (event: MessageEvent<CanvasMessage>) => {
      if (event.data && event.data.source === "jsctrls-canvas" && event.data.type === "ready") {
        setReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // Tell the canvas which file is being designed, then outline the selected node.
  useEffect(() => {
    const target = frame.current?.contentWindow;
    target?.postMessage({ source: "jsctrls-designer", type: "focus", file: fileName }, "*");
    target?.postMessage({ source: "jsctrls-designer", type: "highlight", src }, "*");
  }, [fileName, src, ready]);

  const page = `${url.replace(/\/$/, "")}/?jc-design=1`;
  return (
    <section className="designer-panel designer-canvas" aria-label="Canvas">
      <h2>Canvas: {url}</h2>
      <iframe ref={frame} title="Canvas" src={page} className="designer-frame" />
      {!ready ? (
        <p className="designer-note">
          Waiting for the app at {url}. Start its dev server (make dev) with the jsctrls Vite
          plugin, or set jsctrls.designer.devServerUrl.
        </p>
      ) : null}
      {notice ? <p className="designer-note">{notice}</p> : null}
    </section>
  );
}

type AnyProperty = PublishedProperty<Record<string, unknown>>;

const isEventName = (name: string) => /^on[A-Z]/.test(name);

/** The object inspector: the selected element's properties and events. */
function Inspector({
  dataSet,
  editor,
  onSelect,
}: {
  dataSet: DataSet<Row>;
  editor: Editor;
  onSelect: (id: string) => void;
}) {
  const node = useDataSet(dataSet).current;
  const [tab, setTab] = useState<"properties" | "events">("properties");
  useEffect(() => {
    if (node) {
      onSelect(node.id);
    }
  }, [node, onSelect]);

  if (!node) {
    return null;
  }
  if (node.kind === "locked") {
    return (
      <section className="designer-panel designer-inspector" aria-label="Inspector">
        <h2>Locked: code</h2>
        <pre className="designer-code">{node.source}</pre>
        <p className="designer-note">Edit this in code.</p>
        <Button onClick={() => editor.reveal(node.start)}>Go to code</Button>
      </section>
    );
  }

  const meta = controls.find((candidate) => candidate.name === node.name);
  const published = (meta?.properties ?? []) as readonly AnyProperty[];
  const byName = new Map(node.props.map((prop) => [prop.name, prop]));
  const publishedNames = new Set(published.map((property) => property.name));
  const others = node.props.filter((prop) => !publishedNames.has(prop.name));
  // Plain HTML elements have no meta. Their text and an onClick are still worth offering.
  const plain = /^[a-z]/.test(node.name);
  const properties: AnyProperty[] = [
    ...published.filter((property) => property.kind !== "event"),
    ...(plain && node.content?.kind === "text"
      ? [{ name: "children", kind: "content" } as AnyProperty]
      : []),
  ];
  const events: AnyProperty[] = [
    ...published.filter((property) => property.kind === "event"),
    ...(plain && !byName.has("onClick") ? [{ name: "onClick", kind: "event" } as AnyProperty] : []),
    ...others
      .filter((prop) => isEventName(prop.name))
      .map((prop) => ({ name: prop.name, kind: "event" }) as AnyProperty),
  ];

  return (
    <section className="designer-panel designer-inspector" aria-label="Inspector">
      <h2>
        {node.name}
        {meta ? <span className="designer-tag"> {meta.category}</span> : null}
      </h2>
      <div className="designer-tabs" role="tablist">
        {(["properties", "events"] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className="designer-tab"
            onClick={() => setTab(name)}
          >
            {name === "properties" ? "Properties" : "Events"}
          </button>
        ))}
      </div>
      {tab === "properties" ? (
        <div className="designer-props" role="tabpanel">
          {properties.map((property) => (
            <PropertyRow
              key={`${node.start}:${property.name}:${byName.get(property.name)?.value ?? ""}:${node.content?.kind === "text" ? node.content.value : ""}`}
              node={node}
              property={property}
              prop={byName.get(property.name)}
              editor={editor}
            />
          ))}
          {others
            .filter((prop) => !isEventName(prop.name))
            .map((prop, index) => (
              <PropertyRow
                key={`${node.start}:${prop.name}:${index}:${prop.value}`}
                node={node}
                property={{
                  name: prop.name,
                  kind: prop.kind === "flag" ? "boolean" : "string",
                }}
                prop={prop}
                editor={editor}
              />
            ))}
          <AddProp key={node.start} node={node} editor={editor} />
        </div>
      ) : (
        <div className="designer-props" role="tabpanel">
          {events.length === 0 ? <p className="designer-note">No events.</p> : null}
          {events.map((property) => (
            <EventRow
              key={`${node.start}:${property.name}:${byName.get(property.name)?.value ?? ""}`}
              node={node}
              name={property.name}
              prop={byName.get(property.name)}
              editor={editor}
            />
          ))}
        </div>
      )}
      <h3>Source, line {node.line}</h3>
      <pre className="designer-code">{node.lineText.trim()}</pre>
    </section>
  );
}

/** Commit on Enter or leaving the field; Escape puts the value back. */
function Field({
  id,
  value,
  code,
  placeholder,
  onCommit,
}: {
  id: string;
  value: string;
  code?: boolean;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  // Rows are keyed by their value, so a new value from the file remounts with a fresh draft.
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <TextInput
      id={id}
      value={draft}
      onChange={setDraft}
      onBlur={commit}
      placeholder={placeholder}
      className={code ? "designer-code-input" : undefined}
      spellCheck={!code}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        } else if (event.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}

function PropertyRow({
  node,
  property,
  prop,
  editor,
}: {
  node: Row;
  property: AnyProperty;
  prop: DesignProp | undefined;
  editor: Editor;
}) {
  const id = `prop-${node.start}-${property.name}`;
  const set = (value: PropValue | null) => {
    editor.send({ type: "setProp", node: node.start, name: property.name, value });
  };
  const required = property.required === true;
  const clear =
    prop && !required ? (
      <button
        type="button"
        className="designer-clear"
        title={`Remove ${property.name}`}
        aria-label={`Remove ${property.name}`}
        onClick={() => set(null)}
      >
        ×
      </button>
    ) : null;

  let input: ReactNode;
  if (property.kind === "content") {
    input =
      node.content?.kind === "text" ? (
        <Field
          id={id}
          value={node.content.value}
          onCommit={(text) => editor.send({ type: "setContent", node: node.start, text })}
        />
      ) : (
        <span className="designer-note">Holds elements or code.</span>
      );
  } else if (prop?.kind === "expression" || prop?.name === "...") {
    // Code stays code: edit it as an expression, checked before it is written.
    input =
      prop.name === "..." ? (
        <code>{`{...${prop.value}}`}</code>
      ) : property.kind === "dataSet" ? (
        <DataSetSelect id={id} value={prop.value} editor={editor} required={required} onSet={set} />
      ) : (
        <Field
          id={id}
          code
          value={prop.value}
          onCommit={(code) => set(code.trim() === "" ? null : { kind: "expression", code })}
        />
      );
  } else if (property.kind === "boolean") {
    input = (
      <input
        id={id}
        type="checkbox"
        checked={prop?.kind === "flag" || (prop === undefined && property.default === true)}
        onChange={(event) => {
          const on = event.target.checked;
          const isDefault = on === (property.default === true);
          set(isDefault ? null : on ? { kind: "flag" } : { kind: "expression", code: "false" });
        }}
      />
    );
  } else if (property.kind === "enum") {
    input = (
      <select
        id={id}
        value={prop?.value ?? ""}
        onChange={(event) =>
          set(event.target.value === "" ? null : { kind: "string", text: event.target.value })
        }
      >
        <option value="">
          {property.default === undefined ? "(none)" : `(default: ${String(property.default)})`}
        </option>
        {(property.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  } else if (property.kind === "dataSet") {
    input = <DataSetSelect id={id} value="" editor={editor} required={required} onSet={set} />;
  } else if (property.kind === "field") {
    const boundTo = node.props.find((candidate) => candidate.name === "dataSet")?.value;
    const fields = editor.dataSets.find((candidate) => candidate.name === boundTo)?.fields ?? [];
    input =
      fields.length > 0 ? (
        <select
          id={id}
          value={prop?.value ?? ""}
          onChange={(event) =>
            set(event.target.value === "" ? null : { kind: "string", text: event.target.value })
          }
        >
          {prop === undefined || !fields.some((field) => field.name === prop.value) ? (
            <option value="">{prop?.value ?? "(pick a field)"}</option>
          ) : null}
          {fields.map((field) => (
            <option key={field.name} value={field.name}>
              {field.name}: {field.type}
            </option>
          ))}
        </select>
      ) : (
        <Field
          id={id}
          value={prop?.value ?? ""}
          placeholder="field name"
          onCommit={(text) => set(text === "" ? null : { kind: "string", text })}
        />
      );
  } else if (property.kind === "number") {
    input = (
      <Field
        id={id}
        value={prop?.value ?? ""}
        placeholder={property.default === undefined ? "" : String(property.default)}
        onCommit={(text) =>
          set(text.trim() === "" ? null : { kind: "expression", code: String(Number(text)) })
        }
      />
    );
  } else {
    input = (
      <Field
        id={id}
        value={prop?.value ?? ""}
        placeholder={property.default === undefined ? "" : String(property.default)}
        onCommit={(text) => set(text === "" && !required ? null : { kind: "string", text })}
      />
    );
  }

  return (
    <>
      <label
        htmlFor={id}
        className={prop || property.kind === "content" ? "designer-set" : undefined}
      >
        {property.name === "children" ? "text" : property.name}
        {required ? (
          <span className="designer-required" title="Required">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <div className="designer-value">
        {input}
        {clear}
      </div>
    </>
  );
}

function DataSetSelect({
  id,
  value,
  editor,
  required,
  onSet,
}: {
  id: string;
  value: string;
  editor: Editor;
  required: boolean;
  onSet: (value: PropValue | null) => void;
}) {
  const names = editor.dataSets.map((dataSet) => dataSet.name);
  return (
    <select
      id={id}
      value={value}
      onChange={(event) =>
        onSet(event.target.value === "" ? null : { kind: "expression", code: event.target.value })
      }
    >
      {value === "" || !names.includes(value) ? (
        <option value={value} disabled={required && value === ""}>
          {value === "" ? (names.length === 0 ? "(no DataSet in this file)" : "(none)") : value}
        </option>
      ) : null}
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/** One event: pick an existing handler, create a new one, or jump to the code. */
function EventRow({
  node,
  name,
  prop,
  editor,
}: {
  node: Row;
  name: string;
  prop: DesignProp | undefined;
  editor: Editor;
}) {
  const id = `event-${node.start}-${name}`;
  const handler = prop && editor.handlers.find((candidate) => candidate.name === prop.value);
  const inline = prop !== undefined && handler === undefined;
  return (
    <>
      <label htmlFor={id} className={prop ? "designer-set" : undefined}>
        {name}
      </label>
      <div className="designer-value">
        <select
          id={id}
          value={inline ? "\u0000inline" : (prop?.value ?? "")}
          onChange={(event) => {
            const value = event.target.value;
            editor.send({
              type: "setProp",
              node: node.start,
              name,
              value: value === "" ? null : { kind: "expression", code: value },
            });
          }}
          onDoubleClick={() => {
            if (!prop) {
              editor.send({ type: "createHandler", node: node.start, event: name });
            }
          }}
        >
          <option value="">(none)</option>
          {inline ? (
            <option value={"\u0000inline"} disabled>
              {prop.value.length > 30 ? "(inline code)" : prop.value}
            </option>
          ) : null}
          {editor.handlers.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
        {prop ? (
          <Button
            title="Show the handler in code"
            onClick={() => editor.reveal(handler ? handler.start : prop.at)}
          >
            Code
          </Button>
        ) : (
          <Button
            title={`Create a handler for ${name} and open it in code`}
            onClick={() => editor.send({ type: "createHandler", node: node.start, event: name })}
          >
            New
          </Button>
        )}
      </div>
    </>
  );
}

/** Add a prop the meta does not list, such as className or aria-label. */
function AddProp({ node, editor }: { node: Row; editor: Editor }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const add = () => {
    if (name.trim() === "") {
      return;
    }
    editor.send({
      type: "setProp",
      node: node.start,
      name: name.trim(),
      value: value === "" ? { kind: "flag" } : { kind: "string", text: value },
    });
    setName("");
    setValue("");
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      add();
    }
  };
  return (
    <>
      <TextInput
        value={name}
        onChange={setName}
        onKeyDown={onKeyDown}
        placeholder="new prop"
        aria-label="New prop name"
        className="designer-code-input"
        spellCheck={false}
      />
      <div className="designer-value">
        <TextInput
          value={value}
          onChange={setValue}
          onKeyDown={onKeyDown}
          placeholder="value"
          aria-label="New prop value"
        />
        <Button onClick={add} disabled={name.trim() === ""}>
          Add
        </Button>
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
