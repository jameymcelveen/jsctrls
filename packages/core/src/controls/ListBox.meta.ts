import type { ControlMeta } from "../meta/types";
import type { ListBoxProperties } from "./properties";

export default {
  name: "ListBox",
  tag: "jc-listbox",
  category: "Data-aware",
  properties: [
    { name: "dataSet", kind: "dataSet", bindsTo: "dataSet" },
    { name: "display", kind: "field", bindsTo: "field" },
  ],
} satisfies ControlMeta<ListBoxProperties<{ id: string }>>;
