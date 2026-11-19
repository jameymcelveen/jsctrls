import { useMemo, useSyncExternalStore } from "react";
import { createDataNavigatorController, type DataNavigatorProperties } from "@jsctrls/core";

export type DataNavigatorProps<T extends { id: string }> = DataNavigatorProperties<T>;

/** Bound toolbar. A React skin over the core DataNavigator controller. */
export function DataNavigator<T extends { id: string }>({
  dataSet,
  buttons,
}: DataNavigatorProps<T>) {
  const controller = useMemo(
    () => createDataNavigatorController({ dataSet, buttons }),
    [dataSet, buttons],
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return (
    <div role="toolbar" aria-label="Navigator">
      {snapshot.buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          aria-label={button.label}
          disabled={!button.enabled}
          onClick={() => controller.press(button.id)}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
