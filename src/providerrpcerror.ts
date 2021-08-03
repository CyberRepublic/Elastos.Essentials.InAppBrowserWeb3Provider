export class ProviderRpcError extends Error {
  constructor(private code: number, message: string) {
    super();
    this.message = message;
  }
  
  toString() {
    return `${this.message} (${this.code})`;
  }
}