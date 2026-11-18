import type { KeyboardEvent } from "react";
import type { DataSet } from "../dataset/createDataSet";
import { useDataSet } from "../react/useDataSet";

export interface ListBoxProps<T extends { id: string }> {
  dataSet: DataSet<T>;
  display: keyof T & string;
}

/** Bound list. Click or Up/Down moves the DataSet cursor. */
export function ListBox<T extends { id: string }>({ dataSet, display }: ListBoxProps<T>) {
  const snapshot = useDataSet(dataSet);
  const status =
    snapshot.state === "posting"
      ? "saving..."
      : snapshot.state === "deleting"
        ? "deleting..."
        : snapshot.state === "loading"
          ? "loading..."
          : null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const currentIndex = snapshot.current
      ? snapshot.rows.findIndex((row) => row.id === snapshot.current?.id)
      : -1;
    const nextIndex =
      event.key === "ArrowUp"
        ? Math.max(0, currentIndex - 1)
        : Math.min(snapshot.rows.length - 1, currentIndex + 1);
    const next = snapshot.rows[nextIndex];
    if (next) {
      dataSet.locate(next.id);
    }
  }

  return (
    <div className="jsctrls-list">
      <div
        className="jsctrls-listbox"
        role="listbox"
        tabIndex={0}
        aria-activedescendant={snapshot.current ? optionId(snapshot.current.id) : undefined}
        onKeyDown={onKeyDown}
      >
        {snapshot.rows.map((row) => {
          const selected = snapshot.current?.id === row.id;
          return (
            <div
              key={row.id}
              id={optionId(row.id)}
              role="option"
              aria-selected={selected}
              className={selected ? "jsctrls-option is-selected" : "jsctrls-option"}
              onClick={() => {
                dataSet.locate(row.id);
              }}
            >
              {String(row[display] ?? "")}
            </div>
          );
        })}
      </div>
      {status ? <p className="jsctrls-status">{status}</p> : null}
      {snapshot.error ? (
        <p className="jsctrls-error" role="alert">
          {snapshot.error}
        </p>
      ) : null}
    </div>
  );
}

function optionId(id: string): string {
  return `jsctrls-option-${id}`;
}
