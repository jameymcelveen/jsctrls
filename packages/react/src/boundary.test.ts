import type { ButtonHTMLAttributes } from "react";
import type { ButtonProperties, TextInputProperties } from "@jsctrls/core";
import { describe, expect, it } from "vitest";
import { leakedDesignFiles, reachable, runtimeEntries } from "./bdd/reachable";
import type { TextInputProps } from "./controls/TextInput";

describe("runtime boundary", () => {
  it("runtime entry points import no meta or design file", () => {
    const files = runtimeEntries.flatMap((entry) => [...reachable(entry)]);
    expect(files.length).toBeGreaterThan(5);
    expect(leakedDesignFiles()).toEqual([]);
  });

  it("React skin props satisfy the core properties the meta files are checked against", () => {
    const textInput: TextInputProperties = {} as TextInputProps;
    const button: ButtonProperties = {} as ButtonHTMLAttributes<HTMLButtonElement>;
    expect([textInput, button]).toHaveLength(2);
  });
});
