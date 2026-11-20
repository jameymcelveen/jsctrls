import type { ControlMeta } from "../meta/types";
import type { ListBoxProperties } from "./properties";

export default {
  name: "ListBox",
  tag: "jc-listbox",
  category: "Data-aware",
  properties: [
    { name: "dataSet", kind: "dataSet", bindsTo: "dataSet", required: true },
    { name: "display", kind: "field", bindsTo: "field", required: true },
  ],
} satisfies ControlMeta<ListBoxProperties<{ id: string }>>;
