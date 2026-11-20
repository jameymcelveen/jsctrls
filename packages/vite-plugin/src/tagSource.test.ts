import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tagSource } from "./tagSource.ts";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "../../../apps/hello/src/App.tsx");
const app = readFileSync(appPath, "utf8");

const tags = (code: string) => [...code.matchAll(/data-jc-src="([^"]+)"/g)].map((m) => m[1] ?? "");

describe("tagSource", () => {
  it("tags every element in the hello app with its file and original start offset", () => {
    const tagged = tagSource(app, appPath);
    const found = tags(tagged);
    expect(found).toHaveLength(7);
    for (const src of found) {
      const offset = Number(src.split("#")[1]);
      expect(src.startsWith(`${appPath}#`)).toBe(true);
      expect(app.charAt(offset)).toBe("<");
    }
    const listBox = found
      .map((src) => Number(src.split("#")[1]))
      .find((at) => app.startsWith("<ListBox", at));
    expect(listBox).toBeDefined();
  });

  it("only adds attributes and changes nothing else", () => {
    const tagged = tagSource(app, appPath);
    expect(tagged.replace(/ data-jc-src="[^"]+"/g, "")).toBe(app);
  });

  it("skips fragments and elements that are already tagged", () => {
    const code = `const x = <><Fragment><b data-jc-src="keep" /></Fragment></>;`;
    expect(tags(tagSource(code, "/f.tsx"))).toEqual(["keep"]);
  });
});
