type RequiredAuthEnv = "AUTH_REDIRECT_URL" | "AUTH_EMAIL_FROM";

export function getRequiredAuthEnv(name: RequiredAuthEnv): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function sanitizeRedirectTarget(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://burkursas.local");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalized || "/";
  } catch {
    return null;
  }
}

export function buildRedirectUrl(base: string, redirectTarget: string | null): string {
  if (!redirectTarget) {
    return base;
  }

  const url = new URL(base);
  url.searchParams.set("redirectTo", redirectTarget);
  return url.toString();
}
