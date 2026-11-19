import type { ButtonHTMLAttributes } from "react";

/** Plain button. `type` defaults to `button` so it does not submit a form. */
export function Button({ type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} {...rest} />;
}
