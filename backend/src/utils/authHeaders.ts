import type { Request } from "express";

export function extractBearerToken(req: Request): string | null {
  const header = req.headers["authorization"];

  if (!header || Array.isArray(header)) {
    return null;
  }

  const trimmed = header.trim();

  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}
