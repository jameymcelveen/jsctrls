import type { DataSet } from "../dataset/createDataSet";

/**
 * The framework-neutral properties of each control. Every skin's props must
 * be assignable to these, and meta files are checked against them.
 */

export interface ListBoxProperties<T extends { id: string }> {
  dataSet: DataSet<T>;
  display: keyof T & string;
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
