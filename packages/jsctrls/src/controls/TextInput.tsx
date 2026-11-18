import type { InputHTMLAttributes } from "react";

export interface TextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
}

/** Unbound text field. The caller owns the value. */
export function TextInput({ value, onChange, ...rest }: TextInputProps) {
  return (
    <input
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      {...rest}
    />
  );
}
