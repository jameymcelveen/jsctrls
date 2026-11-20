import type { ControlMeta } from "../meta/types";
import type { DataFieldProperties } from "./properties";

export default {
  name: "DataField",
  tag: "jc-datafield",
  category: "Data-aware",
  properties: [
    { name: "dataSet", kind: "dataSet", bindsTo: "dataSet", required: true },
    { name: "field", kind: "field", bindsTo: "field", required: true },
  ],
} satisfies ControlMeta<DataFieldProperties<{ id: string }>>;
