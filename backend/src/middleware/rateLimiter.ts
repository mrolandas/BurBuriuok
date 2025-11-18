import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.ts";

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  name: string;
  keyExtractor: (req: Request) => string | null;
  burst?: number;
  onLimitExceeded?: (context: RateLimitExceededContext) => void;
}

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

interface RateLimitExceededContext {
  req: Request;
  res: Response;
  retryAfterSeconds: number;
  identifier: string;
}

const buckets = new Map<string, RateLimiterState>();

export function createRateLimiter(options: RateLimiterOptions) {
  const capacity = Math.max(1, options.burst ?? options.limit);
  const refillRate = options.windowMs > 0 ? options.limit / options.windowMs : 0;

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const identifier = options.keyExtractor(req);
    if (!identifier || refillRate <= 0) {
      return next();
    }

    const key = `${options.name}:${identifier}`;
    const now = Date.now();
    const state = buckets.get(key) ?? { tokens: capacity, lastRefill: now };

    if (now > state.lastRefill) {
      const elapsed = now - state.lastRefill;
      const refilled = elapsed * refillRate;
      state.tokens = Math.min(capacity, state.tokens + refilled);
      state.lastRefill = now;
    }

    if (state.tokens >= 1) {
      state.tokens -= 1;
      buckets.set(key, state);
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, Math.floor(state.tokens))));
      res.setHeader("RateLimit-Reset", String(calculateResetTimestamp(now, state.tokens, capacity, refillRate)));
      return next();
    }

    const retryAfterSeconds = calculateRetryAfterSeconds(state.tokens, refillRate);
    buckets.set(key, state);

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader("RateLimit-Remaining", "0");
    res.setHeader("RateLimit-Reset", String(calculateResetTimestamp(now, state.tokens, capacity, refillRate)));

    // eslint-disable-next-line no-console
    console.warn("[rate-limit] bucket_exceeded", {
      bucket: options.name,
      identifier,
      retryAfterSeconds,
      limit: options.limit,
    });

    if (options.onLimitExceeded) {
      options.onLimitExceeded({ req, res, retryAfterSeconds, identifier });
      return;
    }

    return next(new HttpError(429, "Rate limit exceeded.", "RATE_LIMITED"));
  };
}

function calculateRetryAfterSeconds(tokens: number, refillRate: number): number {
  if (refillRate <= 0) {
    return 60;
  }

  const tokensNeeded = Math.max(0, 1 - tokens);
  const retryAfterMs = tokensNeeded / refillRate;
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function calculateResetTimestamp(
  now: number,
  tokens: number,
  capacity: number,
  refillRate: number
): number {
  if (refillRate <= 0) {
    return now;
  }

  const tokensNeededToFill = Math.max(0, capacity - tokens);
  const msUntilFull = tokensNeededToFill / refillRate;
  return Math.trunc(now + msUntilFull);
}
