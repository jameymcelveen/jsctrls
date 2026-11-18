// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConnectorError } from "../connector/connectorError";
import { memoryConnector } from "../connector/memoryConnector";
import type { Connector } from "../connector/types";
import { createDataSet, DataSetError } from "../dataset/createDataSet";
import { useDataSet } from "../react/useDataSet";
import { Button } from "../controls/Button";
import { ListBox } from "../controls/ListBox";
import { TextInput } from "../controls/TextInput";

interface Name {
  id: string;
  name: string;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const specsDir = join(root, "specs");

function scenarioTitles(feature: string): string[] {
  const titles: string[] = [];
  for (const match of feature.matchAll(/^ {2}Scenario: (.+)$/gm)) {
    const title = match[1]?.trim();
    if (!title) {
      throw new Error("A scenario is missing its title");
    }
    titles.push(title);
  }
  return titles;
}

function field(markdown: string, label: string): string | undefined {
  const match = markdown.match(new RegExp(`\\*\\*${label}\\*\\*:\\s*\`([^\`]+)\``));
  return match?.[1];
}

function statusOf(markdown: string): string {
  const match = markdown.match(/\*\*Status\*\*:\s*(Done|Draft)/);
  const status = match?.[1];
  if (!status) {
    throw new Error("Spec is missing Status Done or Draft");
  }
  return status;
}

const handlers: Record<string, () => Promise<void>> = {
  "the library, hello app, and Java server are present": async () => {
    expect(existsSync(join(root, "packages/jsctrls/src/index.ts"))).toBe(true);
    expect(existsSync(join(root, "apps/hello/src/App.tsx"))).toBe(true);
    expect(existsSync(join(root, "server/java/pom.xml"))).toBe(true);
    expect(existsSync(join(root, "server/java/mvnw"))).toBe(true);
  },

  "list returns the records the connector holds": async () => {
    const records = await memoryConnector<Name>([
      { id: "1", name: "Ada" },
      { id: "2", name: "Grace" },
    ]).list();
    expect(records.map((record) => record.name)).toEqual(["Ada", "Grace"]);
  },

  "create assigns an id": async () => {
    const created = await memoryConnector<Name>([]).create({ name: "Iris" });
    expect(created.id).not.toBe("");
    expect(created.name).toBe("Iris");
  },

  "update replaces the record": async () => {
    const connector = memoryConnector<Name>([{ id: "1", name: "Ada" }]);
    await connector.update("1", { name: "Augusta" });
    const stored = await connector.get("1");
    expect(stored.name).toBe("Augusta");
  },

  "a missing record throws ConnectorError": async () => {
    const connector = memoryConnector<Name>([{ id: "1", name: "Ada" }]);
    await connector.remove("1");
    await expect(connector.get("1")).rejects.toBeInstanceOf(ConnectorError);
  },

  "list honors an aborted signal": async () => {
    const signal = AbortSignal.abort();
    await expect(memoryConnector<Name>([]).list({ signal })).rejects.toThrow();
  },

  "open selects the first row": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
      ]),
    });
    await dataSet.open();
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.state).toBe("browse");
    expect(snapshot.current?.name).toBe("Ada");
  },

  "locate moves the cursor": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
      ]),
    });
    await dataSet.open();
    dataSet.locate("2");
    expect(dataSet.getSnapshot().current?.name).toBe("Grace");
  },

  "append posts a row and selects it": async () => {
    const connector = memoryConnector<Name>([{ id: "1", name: "Ada" }]);
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    await dataSet.append({ name: "Iris" });
    expect(dataSet.getSnapshot().current?.name).toBe("Iris");
    expect((await connector.list()).map((record) => record.name)).toContain("Iris");
  },

  "a failed post keeps the pending input": async () => {
    const connector: Connector<Name> = {
      ...memoryConnector<Name>([{ id: "1", name: "Ada" }]),
      create: () => Promise.reject(new ConnectorError(500, "nope")),
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    await expect(dataSet.append({ name: "Iris" })).rejects.toBeInstanceOf(ConnectorError);
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.state).toBe("inserting");
    expect(snapshot.pending).toMatchObject({ name: "Iris" });
    expect(snapshot.error).toBe("nope");
  },

  "delete selects the next row": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
        { id: "3", name: "Katherine" },
      ]),
    });
    await dataSet.open();
    dataSet.locate("2");
    await dataSet.delete();
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.current?.name).toBe("Katherine");
    expect(snapshot.rows.map((row) => row.name)).not.toContain("Grace");
  },

  "delete selects the previous row when the last row is deleted": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
        { id: "3", name: "Katherine" },
      ]),
    });
    await dataSet.open();
    dataSet.locate("3");
    await dataSet.delete();
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.current?.name).toBe("Grace");
    expect(snapshot.rows.map((row) => row.name)).not.toContain("Katherine");
  },

  "a failed delete keeps the row": async () => {
    const connector: Connector<Name> = {
      ...memoryConnector<Name>([{ id: "1", name: "Ada" }]),
      remove: () => Promise.reject(new ConnectorError(500, "nope")),
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    await expect(dataSet.delete()).rejects.toBeInstanceOf(ConnectorError);
    const snapshot = dataSet.getSnapshot();
    expect(snapshot.state).toBe("browse");
    expect(snapshot.current?.name).toBe("Ada");
    expect(snapshot.error).toBe("nope");
  },

  "a second post while posting throws": async () => {
    let release: (row: Name) => void = () => undefined;
    const connector: Connector<Name> = {
      async list() {
        return [{ id: "1", name: "Ada" }];
      },
      async get(id) {
        return { id, name: "Ada" };
      },
      create: () =>
        new Promise<Name>((resolve) => {
          release = resolve;
        }),
      async update() {
        throw new ConnectorError(500, "no");
      },
      async remove() {
        return undefined;
      },
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    const posted = dataSet.append({ name: "Iris" });
    expect(() => {
      dataSet.post();
    }).toThrow(DataSetError);
    release({ id: "2", name: "Iris" });
    await posted;
  },

  "a subscriber re-renders when the cursor moves": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
      ]),
    });
    await dataSet.open();

    function Probe() {
      const snapshot = useDataSet(dataSet);
      return <p>{snapshot.current?.name ?? "none"}</p>;
    }

    render(<Probe />);
    expect(screen.getByText("Ada")).toBeTruthy();
    act(() => {
      dataSet.next();
    });
    expect(screen.getByText("Grace")).toBeTruthy();
  },

  "TextInput reports what the user types": async () => {
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} aria-label="Name" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Iris" },
    });
    expect(onChange).toHaveBeenCalledWith("Iris");
  },

  "a disabled Button does not fire": async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).not.toHaveBeenCalled();
  },

  "ListBox moves the cursor on click and arrow keys": async () => {
    const dataSet = createDataSet({
      connector: memoryConnector<Name>([
        { id: "1", name: "Ada" },
        { id: "2", name: "Grace" },
        { id: "3", name: "Katherine" },
      ]),
    });
    await dataSet.open();
    render(<ListBox dataSet={dataSet} display="name" />);
    fireEvent.click(screen.getByRole("option", { name: "Grace" }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Katherine" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },

  "ListBox shows saving, deleting, and the error": async () => {
    let releaseCreate: (row: Name) => void = () => undefined;
    let releaseRemove: () => void = () => undefined;
    const connector: Connector<Name> = {
      ...memoryConnector<Name>([{ id: "1", name: "Ada" }]),
      create: () =>
        new Promise<Name>((resolve) => {
          releaseCreate = resolve;
        }),
      remove: () =>
        new Promise<void>((resolve) => {
          releaseRemove = resolve;
        }),
    };
    const dataSet = createDataSet({ connector });
    await dataSet.open();
    render(<ListBox dataSet={dataSet} display="name" />);

    act(() => {
      void dataSet.append({ name: "Iris" });
    });
    expect(screen.getByText("saving...")).toBeTruthy();
    await act(async () => {
      releaseCreate({ id: "9", name: "Iris" });
    });

    act(() => {
      void dataSet.delete();
    });
    expect(screen.getByText("deleting...")).toBeTruthy();
    await act(async () => {
      releaseRemove();
    });

    connector.remove = () => Promise.reject(new ConnectorError(500, "database down"));
    await act(async () => {
      await dataSet.delete().catch(() => undefined);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("database down");
  },

  "compose defaults to the java server": async () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf8");
    expect(compose).toContain("./server/${SERVER:-java}");
  },

  "the makefile accepts java, dotnet, go, and node": async () => {
    const makefile = readFileSync(join(root, "Makefile"), "utf8");
    expect(makefile).toContain("SERVER ?= java");
    expect(makefile).toContain("java|dotnet");
    expect(makefile).toContain("go|node");
    expect(makefile).toContain("up-java");
    expect(makefile).toContain("up-dotnet");
  },
};

const used = new Set<string>();

describe("completed specs", () => {
  for (const entry of readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const markdown = readFileSync(join(specsDir, entry.name, "spec.md"), "utf8");
    const status = statusOf(markdown);
    const featurePath = join(specsDir, entry.name, "spec.feature");

    if (status === "Draft") {
      it(`${entry.name} stays a draft`, () => {
        expect(existsSync(featurePath)).toBe(false);
      });
      continue;
    }

    const feature = readFileSync(featurePath, "utf8");
    const titles = scenarioTitles(feature);
    const verifiedBy = field(markdown, "Verified by");
    if (!verifiedBy) {
      throw new Error(`${entry.name} is Done without a verifier`);
    }
    if (titles.length === 0) {
      throw new Error(`${entry.name} has no scenarios`);
    }

    if (verifiedBy === "packages/jsctrls/src/bdd/completed.bdd.test.tsx") {
      for (const title of titles) {
        used.add(title);
        const run = handlers[title];
        it(title, async () => {
          if (!run) {
            throw new Error(`No BDD implementation for: ${title}`);
          }
          await run();
        });
      }
      continue;
    }

    const source = readFileSync(join(root, verifiedBy), "utf8");
    for (const title of titles) {
      it(`${entry.name}: ${title}`, () => {
        expect(source).toContain(`"${title}"`);
      });
    }
  }

  it("every library scenario is listed in a done feature", () => {
    expect(Object.keys(handlers).filter((title) => !used.has(title))).toEqual([]);
  });
});
