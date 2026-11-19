/** What kind of editor the designer shows for a property. */
export type PropertyKind =
  "string" | "number" | "boolean" | "enum" | "dataSet" | "field" | "event" | "content";

export interface PublishedProperty<Props> {
  /** Must be a real prop of the control, or the meta file fails the typecheck. */
  readonly name: keyof Props & string;
  readonly kind: PropertyKind;
  readonly default?: string | number | boolean;
  /** For `enum`: the allowed values. */
  readonly options?: readonly string[];
  /** Set when the property binds to a DataSet or to a field of the bound DataSet. */
  readonly bindsTo?: "dataSet" | "field";
}

export type ControlCategory = "Standard" | "Data-aware" | "Layout" | "Non-visual";

/** Design-time description of a control. Plain data; never shipped in runtime code. */
export interface ControlMeta<Props> {
  /** The React component name. No prefix. */
  readonly name: string;
  /** The web-component tag. Always starts with `jc-`. */
  readonly tag: `jc-${string}`;
  readonly category: ControlCategory;
  readonly properties: readonly PublishedProperty<Props>[];
}
