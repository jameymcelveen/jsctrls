import { useEffect, useMemo, useRef, useState } from "react";
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
  const [model, setModel] = useState<{
    version: number;
    component: string | null;
    rows: Row[];
    fileName: string;
    canvasUrl: string;
  }>();
  const [notice, setNotice] = useState<string | null>(null);
  const dataSetRef = useRef<DataSet<Row> | null>(null);
  const fileNameRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        setModel({
          version: message.version,
          component: message.component,
          rows: toRows(message.nodes),
          fileName: message.fileName,
          canvasUrl: message.canvasUrl,
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
      <section className="designer-panel designer-structure" aria-label="Structure">
        <h2>Structure: {model.component}</h2>
        <ListBox dataSet={dataSet} display="label" />
      </section>
      <Canvas dataSet={dataSet} fileName={model.fileName} url={model.canvasUrl} notice={notice} />
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

type CanvasMessage =
  | { source: "jsctrls-canvas"; type: "select"; src: string }
  | { source: "jsctrls-canvas"; type: "ready" };

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
