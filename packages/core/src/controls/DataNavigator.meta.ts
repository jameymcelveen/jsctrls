import type { ControlMeta } from "../meta/types";
import type { DataNavigatorProperties } from "./properties";

export default {
  name: "DataNavigator",
  tag: "jc-datanavigator",
  category: "Data-aware",
  properties: [{ name: "dataSet", kind: "dataSet", bindsTo: "dataSet" }],
} satisfies ControlMeta<DataNavigatorProperties<{ id: string }>>;
