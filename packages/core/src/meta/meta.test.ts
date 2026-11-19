import { describe, expect, it } from "vitest";
import { controls, listBoxMeta } from "./index";

describe("control meta", () => {
  it("names the ListBox tag and binds dataSet to a DataSet", () => {
    expect(listBoxMeta.tag).toBe("jc-listbox");
    expect(listBoxMeta.properties.find((property) => property.name === "dataSet")?.bindsTo).toBe(
      "dataSet",
    );
  });

  it("gives every control a jc- tag and a name with no prefix", () => {
    for (const meta of controls) {
      expect(meta.tag).toBe(`jc-${meta.name.toLowerCase()}`);
      expect(meta.name).toMatch(/^[A-Z][A-Za-z]+$/);
    }
  });
});
