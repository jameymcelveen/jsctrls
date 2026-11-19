import { describe, expect, it } from "vitest";
import { version } from "./index";

describe("jsctrls", () => {
  it("exposes the package version", () => {
    expect(version).toBe("0.0.0");
  });
});
