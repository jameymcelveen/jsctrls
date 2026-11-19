import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ButtonHTMLAttributes } from "react";
import type { ButtonProperties, TextInputProperties } from "@jsctrls/core";
import { describe, expect, it } from "vitest";
import type { TextInputProps } from "./controls/TextInput";

const packages = join(dirname(fileURLToPath(import.meta.url)), "../..");
const entries = [join(packages, "core/src/index.ts"), join(packages, "react/src/index.ts")];

/** Every file reachable from a runtime entry point, following relative and @jsctrls/core imports. */
function reachable(start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) {
      continue;
    }
    seen.add(file);
    const source = readFileSync(file, "utf8");
    const pattern = /(?:^|[;\n])\s*(?:import|export)\s*(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      const spec = match[1] ?? "";
      if (spec === "@jsctrls/core") {
        queue.push(join(packages, "core/src/index.ts"));
      } else if (spec.startsWith(".")) {
        const base = resolve(dirname(file), spec);
        const found = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
        if (found) {
          queue.push(found);
        }
      }
    }
  }
  return seen;
}

describe("runtime boundary", () => {
  it("runtime entry points import no meta or design file", () => {
    const files = entries.flatMap((entry) => [...reachable(entry)]);
    expect(files.length).toBeGreaterThan(5);
    expect(files.filter((file) => /\.(meta|design)\.tsx?$/.test(file))).toEqual([]);
  });

  it("React skin props satisfy the core properties the meta files are checked against", () => {
    const textInput: TextInputProperties = {} as TextInputProps;
    const button: ButtonProperties = {} as ButtonHTMLAttributes<HTMLButtonElement>;
    expect([textInput, button]).toHaveLength(2);
  });
});
