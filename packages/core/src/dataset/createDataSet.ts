import type { Connector } from "../connector/types";

export type DataSetState =
  "idle" | "loading" | "browse" | "inserting" | "editing" | "posting" | "deleting" | "error";

export interface DataSetSnapshot<T> {
  readonly state: DataSetState;
  readonly rows: readonly T[];
  readonly current: T | null;
  readonly pending: Readonly<Partial<T>> | null;
  readonly error: string | null;
  readonly busy: boolean;
}

export interface DataSet<T extends { id: string }> {
  open(): Promise<void>;
  refresh(): Promise<void>;
  first(): void;
  prior(): void;
  next(): void;
  last(): void;
  locate(id: string): void;
  insert(): void;
  edit(): void;
  setField<K extends keyof T>(name: K, value: T[K]): void;
  post(): Promise<void>;
  cancel(): void;
  delete(): Promise<void>;
  append(values: Omit<T, "id">): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): DataSetSnapshot<T>;
}

/** Thrown when an operation is illegal in the current state. */
export class DataSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSetError";
  }
}

/** A cursor, edit buffer, and connector calls. No React. */
export function createDataSet<T extends { id: string }>(options: {
  connector: Connector<T>;
}): DataSet<T> {
  let state: DataSetState = "idle";
  let rows: T[] = [];
  let index: number | null = null;
  let pending: Partial<T> | null = null;
  let error: string | null = null;
  let snapshot = build();
  let listGeneration = 0;
  let listController: AbortController | null = null;
  const listeners = new Set<() => void>();

  function build(): DataSetSnapshot<T> {
    return {
      state,
      rows,
      current: index === null ? null : (rows[index] ?? null),
      pending,
      error,
      busy: state === "loading" || state === "posting" || state === "deleting",
    };
  }

  function publish(): void {
    rows = rows.slice();
    pending = pending === null ? null : { ...pending };
    snapshot = build();
    for (const listener of listeners) {
      listener();
    }
  }

  function currentRow(): T | null {
    return index === null ? null : (rows[index] ?? null);
  }

  function guardIdle(): void {
    if (state === "loading" || state === "posting" || state === "deleting") {
      throw new DataSetError(`Cannot change the dataset while it is ${state}`);
    }
  }

  async function load(preserveId: string | null): Promise<void> {
    if (state === "posting" || state === "deleting") {
      throw new DataSetError(`Cannot change the dataset while it is ${state}`);
    }
    listController?.abort();
    const controller = new AbortController();
    listController = controller;
    const generation = ++listGeneration;
    state = "loading";
    error = null;
    publish();
    try {
      const loaded = await options.connector.list({ signal: controller.signal });
      if (generation !== listGeneration) {
        return;
      }
      rows = loaded.map((row) => structuredClone(row));
      const preserved = preserveId === null ? -1 : rows.findIndex((row) => row.id === preserveId);
      index = preserved >= 0 ? preserved : rows.length > 0 ? 0 : null;
      state = "browse";
      pending = null;
      error = null;
      publish();
    } catch (caught) {
      if (generation !== listGeneration || controller.signal.aborted) {
        return;
      }
      state = "error";
      error = messageOf(caught);
      publish();
      throw caught;
    }
  }

  function move(nextIndex: number | null): void {
    if (state !== "browse") {
      return;
    }
    index = nextIndex;
    publish();
  }

  function insert(): void {
    guardIdle();
    if (state !== "browse" && state !== "idle") {
      throw new DataSetError(`Cannot insert while ${state}`);
    }
    state = "inserting";
    pending = {};
    error = null;
    publish();
  }

  function setField<K extends keyof T>(name: K, value: T[K]): void {
    if (state !== "inserting" && state !== "editing") {
      throw new DataSetError(`Cannot set a field while ${state}`);
    }
    pending = { ...pending, [name]: value } as Partial<T>;
    publish();
  }

  function post(): Promise<void> {
    if (state !== "inserting" && state !== "editing") {
      throw new DataSetError(`Cannot post while ${state}`);
    }
    return commit();
  }

  async function commit(): Promise<void> {
    const mode = state;
    const draft = { ...pending } as Partial<T>;
    state = "posting";
    error = null;
    publish();
    try {
      if (mode === "inserting") {
        const created = await options.connector.create(withoutId(draft));
        rows = [...rows, structuredClone(created)];
        index = rows.length - 1;
      } else {
        const current = currentRow();
        if (!current) {
          throw new DataSetError("Cannot post an edit without a current row");
        }
        const updated = await options.connector.update(current.id, draft);
        rows = rows.map((row) => (row.id === current.id ? structuredClone(updated) : row));
        const nextIndex = rows.findIndex((row) => row.id === updated.id);
        index = nextIndex >= 0 ? nextIndex : index;
      }
      state = "browse";
      pending = null;
      error = null;
      publish();
    } catch (caught) {
      state = mode;
      pending = draft;
      error = messageOf(caught);
      publish();
      throw caught;
    }
  }

  function remove(): Promise<void> {
    guardIdle();
    const current = currentRow();
    if (state !== "browse" || index === null || !current) {
      throw new DataSetError("Cannot delete without a current row");
    }
    return removeRow(current, index);
  }

  async function removeRow(current: T, removedIndex: number): Promise<void> {
    const removedId = current.id;
    state = "deleting";
    error = null;
    publish();
    try {
      await options.connector.remove(removedId);
      rows = rows.filter((row) => row.id !== removedId);
      if (rows.length === 0) {
        index = null;
      } else if (removedIndex >= rows.length) {
        index = rows.length - 1;
      } else {
        index = removedIndex;
      }
      state = "browse";
      error = null;
      publish();
    } catch (caught) {
      state = "browse";
      error = messageOf(caught);
      publish();
      throw caught;
    }
  }

  return {
    open: () => load(null),
    refresh: () => load(currentRow()?.id ?? null),
    first: () => {
      move(rows.length > 0 ? 0 : null);
    },
    prior: () => {
      move(index === null || index <= 0 ? index : index - 1);
    },
    next: () => {
      move(index === null ? null : Math.min(index + 1, rows.length - 1));
    },
    last: () => {
      move(rows.length > 0 ? rows.length - 1 : null);
    },
    locate(id) {
      const found = rows.findIndex((row) => row.id === id);
      move(found >= 0 ? found : index);
    },
    insert,
    edit() {
      guardIdle();
      const current = currentRow();
      if (state !== "browse" || !current) {
        throw new DataSetError("Cannot edit without a current row");
      }
      state = "editing";
      pending = { ...current };
      error = null;
      publish();
    },
    setField,
    post,
    cancel() {
      if (state !== "inserting" && state !== "editing") {
        throw new DataSetError(`Cannot cancel while ${state}`);
      }
      state = "browse";
      pending = null;
      error = null;
      publish();
    },
    delete: remove,
    async append(values) {
      insert();
      for (const [name, value] of Object.entries(values) as [keyof T, T[keyof T]][]) {
        setField(name, value);
      }
      await post();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

function withoutId<T extends { id: string }>(draft: Partial<T>): Omit<T, "id"> {
  const fields = { ...draft };
  Reflect.deleteProperty(fields, "id");
  return fields as Omit<T, "id">;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Request failed";
}
