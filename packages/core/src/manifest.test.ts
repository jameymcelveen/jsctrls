import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"),
) as Record<string, Record<string, string> | undefined>;

describe("@jsctrls/core manifest", () => {
  it("lists no UI framework in any dependency field", () => {
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const names = fields.flatMap((field) => Object.keys(manifest[field] ?? {}));
    expect(names.filter((name) => /^(react|react-dom|@types\/react)/.test(name))).toEqual([]);
  });
});
