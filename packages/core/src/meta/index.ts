/**
 * Design-time entry point: `@jsctrls/core/meta`. Runtime code never imports
 * this module, so meta never ships in an app bundle.
 */
import buttonMeta from "../controls/Button.meta";
import listBoxMeta from "../controls/ListBox.meta";
import textInputMeta from "../controls/TextInput.meta";

export type { ControlCategory, ControlMeta, PropertyKind, PublishedProperty } from "./types";
export { buttonMeta, listBoxMeta, textInputMeta };

/** Every control's meta, in palette order. */
export const controls = [textInputMeta, buttonMeta, listBoxMeta] as const;
