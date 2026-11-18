/** A list query. `signal` lets a newer `list` cancel an older one. */
export interface Query {
  readonly signal?: AbortSignal;
}

/**
 * CRUD against one resource. Implementations know the transport and nothing about React.
 * `K` is the id type. The record's id field is named `id`.
 */
export interface Connector<T, K = string> {
  list(query?: Query): Promise<T[]>;
  get(id: K): Promise<T>;
  create(item: Omit<T, "id">): Promise<T>;
  update(id: K, item: Partial<T>): Promise<T>;
  remove(id: K): Promise<void>;
}
