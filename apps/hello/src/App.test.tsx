import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

interface Name {
  id: string;
  name: string;
}

describe("App", () => {
  const rows: Name[] = [
    { id: "1", name: "Ada" },
    { id: "2", name: "Grace" },
    { id: "3", name: "Katherine" },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a name and deletes the current one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (method === "GET" && url.endsWith("/names")) {
          return Response.json(rows);
        }
        if (method === "POST") {
          const body = JSON.parse(String(init?.body)) as { name: string };
          const created = { id: "9", name: body.name };
          rows.push(created);
          return Response.json(created, { status: 201 });
        }
        if (method === "DELETE") {
          const id = url.slice(url.lastIndexOf("/") + 1);
          const index = rows.findIndex((row) => row.id === decodeURIComponent(id));
          if (index >= 0) {
            rows.splice(index, 1);
          }
          return new Response(null, { status: 204 });
        }
        return Response.json({ detail: "Not found" }, { status: 404 });
      }),
    );

    render(<App />);

    expect(await screen.findByRole("option", { name: "Ada" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Iris" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("option", { name: "Iris" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Iris" })).toBeNull();
    });
    expect(screen.getByRole("option", { name: "Katherine" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
