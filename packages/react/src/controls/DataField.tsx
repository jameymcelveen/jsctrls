import type { InputHTMLAttributes } from "react";
import { useMemo, useSyncExternalStore } from "react";
import { createDataFieldController, type DataFieldProperties } from "@jsctrls/core";

export type DataFieldProps<T extends { id: string }> = DataFieldProperties<T> &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange">;

/** Bound text field. A React skin over the core DataField controller. */
export function DataField<T extends { id: string }>({
  dataSet,
  field,
  disabled,
  readOnly,
  ...rest
}: DataFieldProps<T>) {
  const controller = useMemo(() => createDataFieldController({ dataSet, field }), [dataSet, field]);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return (
    <input
      {...rest}
      value={snapshot.value}
      disabled={snapshot.disabled || Boolean(disabled)}
      readOnly={snapshot.readOnly || Boolean(readOnly)}
      onChange={(event) => {
        controller.change(event.target.value);
      }}
    />
  );
}
