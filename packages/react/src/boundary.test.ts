import type { ButtonHTMLAttributes } from "react";
import type { ButtonProperties, DataFieldProperties, TextInputProperties } from "@jsctrls/core";
import { describe, expect, it } from "vitest";
import { leakedDesignFiles, reachable, runtimeEntries } from "./bdd/reachable";
import type { DataFieldProps } from "./controls/DataField";
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
    const dataField: DataFieldProperties<{ id: string; name: string }> = {} as DataFieldProps<{
      id: string;
      name: string;
    }>;
    expect([textInput, button, dataField]).toHaveLength(3);
  });
});
