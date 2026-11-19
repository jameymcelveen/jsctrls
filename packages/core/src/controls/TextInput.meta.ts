import type { ControlMeta } from "../meta/types";
import type { TextInputProperties } from "./properties";

export default {
  name: "TextInput",
  tag: "jc-textinput",
  category: "Standard",
  properties: [
    { name: "value", kind: "string", default: "" },
    { name: "placeholder", kind: "string" },
    { name: "disabled", kind: "boolean", default: false },
    { name: "onChange", kind: "event" },
  ],
} satisfies ControlMeta<TextInputProperties>;
