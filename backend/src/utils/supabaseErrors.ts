function extractMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  const maybeMessage = (error as { message?: unknown }).message;
  if (typeof maybeMessage === "string") {
    return maybeMessage;
  }

  return null;
}

function extractCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string") {
    return maybeCode;
  }

  const details = (error as { details?: unknown }).details;
  if (typeof details === "string") {
    if (details.includes("duplicate key value")) {
      return "23505";
    }
    if (details.includes("foreign key constraint")) {
      return "23503";
    }
  }

  return null;
}

export function isSupabaseAuthError(error: unknown): boolean {
  const message = extractMessage(error);
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes("invalid api key");
}

export function isUniqueConstraintError(error: unknown): boolean {
  const code = extractCode(error);
  if (code === "23505") {
    return true;
  }

  const message = extractMessage(error);
  return Boolean(message && message.toLowerCase().includes("duplicate key value"));
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  const code = extractCode(error);
  if (code === "23503") {
    return true;
  }

  const message = extractMessage(error);
  return Boolean(message && message.toLowerCase().includes("foreign key constraint"));
}

export function getSupabaseErrorCode(error: unknown): string | null {
  return extractCode(error);
}
