// Error with an HTTP status and a stable code. The client translates the code through the i18n dictionary, so the
// server never sends user-facing text.
export class AppError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
