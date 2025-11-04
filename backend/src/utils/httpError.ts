export class HttpError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "HttpError";
  }
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}
