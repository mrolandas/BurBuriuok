import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.ts";

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  name: string;
  keyExtractor: (req: Request) => string | null;
}

interface RateLimiterState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimiterState>();

export function createRateLimiter(options: RateLimiterOptions) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const identifier = options.keyExtractor(req);
    if (!identifier) {
      return next();
    }

    const key = `${options.name}:${identifier}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader("RateLimit-Remaining", String(options.limit - 1));
      res.setHeader("RateLimit-Reset", String(now + options.windowMs));
      return next();
    }

    if (existing.count >= options.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(existing.resetAt));
      return next(
        new HttpError(429, "Rate limit exceeded.", "RATE_LIMIT_EXCEEDED")
      );
    }

    existing.count += 1;
    buckets.set(key, existing);
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader(
      "RateLimit-Remaining",
      String(Math.max(0, options.limit - existing.count))
    );
    res.setHeader("RateLimit-Reset", String(existing.resetAt));
    return next();
  };
}
