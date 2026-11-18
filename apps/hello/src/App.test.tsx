import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the library placeholder", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "jsctrls" })).toBeInTheDocument();
    expect(screen.getByText("Library 0.0.0")).toBeInTheDocument();
  });
});
