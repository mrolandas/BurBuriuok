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

export function unauthorized(message: string): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}
