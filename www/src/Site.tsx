import { useEffect, useRef, useState } from "react";
import { Button, ListBox, TextInput, useDataSet, type DataSet } from "@jsctrls/react";
import type { JcListBox } from "@jsctrls/elements";

type Name = { id: string; name: string };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "jc-listbox": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        display?: string;
      };
    }
  }
}

const GITHUB = "https://github.com/jameymcelveen/jsctrls";

const helloWorld = `const names = createDataSet<Name>({
  connector: restConnector({ baseUrl: "/api", resource: "names" }),
});

function App() {
  const [text, setText] = useState("");
  const ds = useDataSet(names);
  return (
    <>
      <TextInput value={text} onChange={setText} />
      <Button onClick={() => names.append({ name: text })}>Add</Button>
      <Button onClick={() => names.delete()}>Delete</Button>
      <ListBox dataSet={names} display="name" />
    </>
  );
}`;

const layers = [
  ["Connector", "TConnection, TRESTClient", "CRUD over one resource. HTTP only, no state."],
  ["DataSet", "TDataSet", "Rows, cursor, edit buffer, loading and errors. No React."],
  ["Binding", "TDataSource", "React subscribes to a DataSet with useSyncExternalStore."],
  ["Controls", "DB-aware controls", "Show and edit data. They never call a server."],
] as const;

export function Site({ names }: { names: DataSet<Name> }) {
  return (
    <>
      <header className="top">
        <a className="brand" href="/">
          jsctrls
        </a>
        <nav aria-label="Site">
          <a href="#demo">Demo</a>
          <a href="#how">How it works</a>
          <a href="/example/">Example app</a>
          <a href={GITHUB}>GitHub</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Early development, MIT licensed</p>
          <h1>Data-aware React controls, inspired by Delphi.</h1>
          <p className="lede">
            Point a control at a DataSet and it reads, edits, posts and cancels. You stop rewriting
            the same loading, saving and error plumbing in every screen.
          </p>
          <div className="actions">
            <a className="button primary" href="#demo">
              Try the live demo
            </a>
            <a className="button" href={GITHUB}>
              Read the source
            </a>
          </div>
        </section>

        <Demo names={names} />

        <section id="how" className="band">
          <h2>Four layers, one job each</h2>
          <p>
            The rule: a control never talks to a server. Swap the connector and nothing above it
            changes.
          </p>
          <div className="layers">
            {layers.map(([name, delphi, job]) => (
              <article key={name} className="layer">
                <h3>{name}</h3>
                <p className="delphi">Borrows from {delphi}</p>
                <p>{job}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="band split">
          <div>
            <h2>A Delphi-inspired hello world</h2>
            <p>
              An edit box, a list box and an Add button, plus Delete. The controls know how to load,
              show the cursor, and say saving or deleting while the server works.
            </p>
            <p>
              <a href="/example/">Open the example app</a> to run exactly this code.
            </p>
          </div>
          <pre className="code">
            <code>{helloWorld}</code>
          </pre>
        </section>

        <section className="band">
          <h2>React is a skin</h2>
          <p>
            Connectors, the DataSet and each control&apos;s behavior live in{" "}
            <code>@jsctrls/core</code>, which imports no UI framework, and a lint rule keeps it that
            way. <code>@jsctrls/react</code> renders that behavior with React.{" "}
            <code>@jsctrls/elements</code> renders the same behavior as web components, starting
            with <code>&lt;jc-listbox&gt;</code>. If the framework changes, the behavior stays.
          </p>
          <p className="aside">
            The <code>jc-</code> tag prefix is named for J.C. Yarborough.
          </p>
        </section>

        <section className="band">
          <h2>Where it stands</h2>
          <ul className="status">
            <li className="done">Connectors, the DataSet, and the React binding</li>
            <li className="done">TextInput, Button and ListBox</li>
            <li className="done">A headless core, typed control meta, and jc-listbox</li>
            <li className="done">
              One demo API in Java, .NET and Go, all passing one conformance suite
            </li>
            <li>DataField, DataNavigator and DataGrid</li>
            <li>A drag-and-drop designer for .tsx files, as a VS Code extension (spike started)</li>
          </ul>
          <p className="aside">Not published to npm yet.</p>
        </section>
      </main>

      <footer className="foot">
        <p>
          Built by <a href="https://jameymcelveen.com">Jamey McElveen</a>, who has been building
          components since the Delphi days.
        </p>
        <p>
          <a href={GITHUB}>GitHub</a> | MIT license
        </p>
      </footer>
    </>
  );
}

function Demo({ names }: { names: DataSet<Name> }) {
  const [text, setText] = useState("");
  const snapshot = useDataSet(names);
  const element = useRef<JcListBox | null>(null);

  useEffect(() => {
    void names.open().catch(() => undefined);
  }, [names]);

  useEffect(() => {
    if (element.current) {
      element.current.dataSet = names as unknown as JcListBox["dataSet"];
    }
  }, [names]);

  const add = () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    void names
      .append({ name: value })
      .then(() => {
        setText("");
      })
      .catch(() => undefined);
  };

  return (
    <section id="demo" className="band demo">
      <h2>Live demo</h2>
      <p>
        One DataSet, two skins. The list on the left is the React <code>ListBox</code>. The list on
        the right is the <code>&lt;jc-listbox&gt;</code> web component. Both run on the same core
        controller, so moving the cursor in one moves it in the other.
      </p>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label htmlFor="demo-name" className="sr-only">
          Name
        </label>
        <TextInput
          id="demo-name"
          value={text}
          onChange={setText}
          placeholder="Type a name"
          maxLength={100}
        />
        <Button type="submit" disabled={!text.trim() || snapshot.busy}>
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
      </form>
      <div className="skins">
        <figure>
          <figcaption>React ListBox</figcaption>
          <ListBox dataSet={names} display="name" />
        </figure>
        <figure>
          <figcaption>&lt;jc-listbox&gt;</figcaption>
          <jc-listbox ref={element} display="name" />
        </figure>
      </div>
      <p className="aside">
        Every Add and Delete is a real HTTP call to a Vercel function, slowed down on purpose so you
        can see the controls report it. The data lives in memory and resets now and then.
      </p>
    </section>
  );
}
