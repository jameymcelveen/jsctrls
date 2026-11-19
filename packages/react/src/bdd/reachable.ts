import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the packages folder. Test helper; excluded from the build. */
export const packagesDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The runtime entry points of the core and React packages. */
export const runtimeEntries = [
  join(packagesDir, "core/src/index.ts"),
  join(packagesDir, "react/src/index.ts"),
];

/** Every file reachable from `start`, following relative and @jsctrls/core imports. */
export function reachable(start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  const pattern = /(?:^|[;\n])\s*(?:import|export)\s*(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']/g;
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) {
      continue;
    }
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      const spec = match[1] ?? "";
      if (spec === "@jsctrls/core") {
        queue.push(join(packagesDir, "core/src/index.ts"));
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

/** Meta or design files reachable from the runtime entry points. Should be empty. */
export function leakedDesignFiles(): string[] {
  return runtimeEntries
    .flatMap((entry) => [...reachable(entry)])
    .filter((file) => /\.(meta|design)\.tsx?$/.test(file));
}
