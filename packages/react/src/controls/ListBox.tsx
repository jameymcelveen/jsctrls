import { useMemo, useSyncExternalStore } from "react";
import { createListBoxController, type ListBoxProperties } from "@jsctrls/core";

export type ListBoxProps<T extends { id: string }> = ListBoxProperties<T>;

/** Bound list. A React skin over the core ListBox controller. */
export function ListBox<T extends { id: string }>({ dataSet, display }: ListBoxProps<T>) {
  const controller = useMemo(
    () => createListBoxController({ dataSet, display }),
    [dataSet, display],
  );
  const { options, list, status, error } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return (
    <div className="jsctrls-list">
      <div
        className="jsctrls-listbox"
        role={list.role}
        tabIndex={0}
        aria-activedescendant={list["aria-activedescendant"]}
        onKeyDown={(event) => {
          if (controller.keyDown(event.key)) {
            event.preventDefault();
          }
        }}
      >
        {options.map((option) => (
          <div
            key={option.id}
            id={option.attributes.id}
            role={option.attributes.role}
            aria-selected={option.selected}
            className={option.selected ? "jsctrls-option is-selected" : "jsctrls-option"}
            onClick={() => {
              controller.select(option.id);
            }}
          >
            {option.label}
          </div>
        ))}
      </div>
      {status ? <p className="jsctrls-status">{status}</p> : null}
      {error ? (
        <p className="jsctrls-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
