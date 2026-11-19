import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createDataSet, ListBox, memoryConnector, TextInput, useDataSet } from "@jsctrls/react";
import type { DataSet } from "@jsctrls/react";
import "@jsctrls/react/styles.css";
import "./designer.css";
import type { DesignNode, DesignProp } from "../src/model";
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

function App() {
  const [model, setModel] = useState<{ version: number; component: string | null; rows: Row[] }>();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const message = event.data;
      if (message.type === "model") {
        setModel({
          version: message.version,
          component: message.component,
          rows: toRows(message.nodes),
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
    if (!dataSet) {
      return;
    }
    void dataSet.open().then(() => {
      const keep = selectedId && dataSet.getSnapshot().rows.some((row) => row.id === selectedId);
      if (keep) {
        dataSet.locate(selectedId);
      }
    });
    // selectedId is read once per new DataSet on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet]);

  if (!model || !dataSet) {
    return <p className="designer-empty">Reading the file.</p>;
  }
  if (model.rows.length === 0) {
    return <p className="designer-empty">No component with JSX was found in this file.</p>;
  }
  return (
    <div className="designer">
      <section className="designer-panel" aria-label="Structure">
        <h2>Structure: {model.component}</h2>
        <ListBox dataSet={dataSet} display="label" />
      </section>
      <Inspector
        dataSet={dataSet}
        version={model.version}
        onSelect={setSelectedId}
        onEdit={() => {
          setError(null);
        }}
      />
      {error ? (
        <p className="designer-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Inspector({
  dataSet,
  version,
  onSelect,
  onEdit,
}: {
  dataSet: DataSet<Row>;
  version: number;
  onSelect: (id: string) => void;
  onEdit: () => void;
}) {
  const node = useDataSet(dataSet).current;
  useEffect(() => {
    if (node) {
      onSelect(node.id);
    }
  }, [node, onSelect]);

  if (!node) {
    return null;
  }
  return (
    <section className="designer-panel" aria-label="Inspector">
      <h2>{node.kind === "locked" ? "Locked: code" : node.name}</h2>
      {node.kind === "locked" ? (
        <>
          <pre className="designer-code">{node.source}</pre>
          <p className="designer-note">Edit in code.</p>
        </>
      ) : node.props.length === 0 ? (
        <p className="designer-note">No props.</p>
      ) : (
        <dl className="designer-props">
          {node.props.map((prop, index) => (
            <PropRow
              key={`${node.id}:${prop.name}:${index}:${prop.value}`}
              prop={prop}
              version={version}
              onEdit={onEdit}
            />
          ))}
        </dl>
      )}
      <h3>Source, line {node.line}</h3>
      <pre className="designer-code">{node.lineText.trim()}</pre>
    </section>
  );
}

function PropRow({
  prop,
  version,
  onEdit,
}: {
  prop: DesignProp;
  version: number;
  onEdit: () => void;
}) {
  // The parent keys this row by the prop's value, so a new value remounts it with a fresh draft.
  const [draft, setDraft] = useState(prop.value);

  if (prop.kind !== "string" || prop.start === undefined || prop.end === undefined) {
    return (
      <>
        <dt>{prop.name}</dt>
        <dd>
          <code>{prop.value}</code>{" "}
          <span className="designer-tag">{prop.kind === "flag" ? "flag" : "code"}</span>
        </dd>
      </>
    );
  }
  const { start, end } = prop;
  const commit = () => {
    if (draft !== prop.value) {
      onEdit();
      vscode.postMessage({ type: "edit", version, start, end, newText: draft });
    }
  };
  const inputId = `prop-${start}`;
  return (
    <>
      <dt>
        <label htmlFor={inputId}>{prop.name}</label>
      </dt>
      <dd>
        <TextInput
          id={inputId}
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            } else if (event.key === "Escape") {
              setDraft(prop.value);
            }
          }}
        />
      </dd>
    </>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
