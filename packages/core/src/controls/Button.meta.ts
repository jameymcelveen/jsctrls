import type { ControlMeta } from "../meta/types";
import type { ButtonProperties } from "./properties";

export default {
  name: "Button",
  tag: "jc-button",
  category: "Standard",
  properties: [
    { name: "children", kind: "content", default: "Button" },
    { name: "disabled", kind: "boolean", default: false },
    { name: "type", kind: "enum", options: ["button", "submit", "reset"], default: "button" },
    { name: "onClick", kind: "event" },
  ],
} satisfies ControlMeta<ButtonProperties>;
