import { useEffect, useState } from "react";
import {
  Button,
  createDataSet,
  ListBox,
  restConnector,
  TextInput,
  useDataSet,
} from "@jsctrls/react";
import "@jsctrls/react/styles.css";

const names = createDataSet<{ id: string; name: string }>({
  connector: restConnector({ baseUrl: "/api", resource: "names" }),
});

export function App() {
  const [text, setText] = useState("");
  const snapshot = useDataSet(names);

  useEffect(() => {
    void names.open().catch(() => undefined);
  }, []);

  return (
    <main>
      <h1>Names</h1>
      <div className="row">
        <TextInput value={text} onChange={setText} aria-label="Name" />
        <Button
          disabled={!text.trim() || snapshot.busy}
          onClick={() => {
            void names
              .append({ name: text })
              .then(() => {
                setText("");
              })
              .catch(() => undefined);
          }}
        >
          Add
        </Button>
        <Button
          disabled={snapshot.current == null || snapshot.busy}
          onClick={() => {
            void names.delete().catch(() => undefined);
          }}
        >
          Delete
        </Button>
      </div>
      <ListBox dataSet={names} display="name" />
    </main>
  );
}
