import type { DataSet } from "../dataset/createDataSet";

/**
 * The framework-neutral properties of each control. Every skin's props must
 * be assignable to these, and meta files are checked against them.
 */

export interface ListBoxProperties<T extends { id: string }> {
  dataSet: DataSet<T>;
  display: keyof T & string;
}

/** Keys of T whose values are text, so a text control can never write a string into a number. */
export type StringFieldOf<T> = {
  [K in keyof T]-?: T[K] extends string | null | undefined ? K : never;
}[keyof T] &
  string;

export interface DataFieldProperties<T extends { id: string }> {
  dataSet: DataSet<T>;
  field: StringFieldOf<T>;
}

/** Toolbar order. Delphi's TDBNavigator uses this sequence. */
export const dataNavigatorButtons = [
  "first",
  "prior",
  "next",
  "last",
  "insert",
  "delete",
  "edit",
  "post",
  "cancel",
  "refresh",
] as const;

export type DataNavigatorButtonId = (typeof dataNavigatorButtons)[number];

export interface DataNavigatorProperties<T extends { id: string }> {
  dataSet: DataSet<T>;
  /** When set, only these buttons are shown, still in toolbar order. */
  buttons?: readonly DataNavigatorButtonId[] | undefined;
}

export interface TextInputProperties {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
}

export interface ButtonProperties {
  children?: unknown;
  disabled?: boolean | undefined;
  type?: "button" | "submit" | "reset" | undefined;
  onClick?: ((...args: never[]) => void) | undefined;
}
