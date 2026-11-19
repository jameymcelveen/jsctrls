/** A non-2xx response from a connector. */
export class ConnectorError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ConnectorError";
    this.status = status;
  }
}
