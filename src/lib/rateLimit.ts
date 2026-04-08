/**
 * Simple in-memory sliding window rate limiter.
 * No external dependencies required.
 *
 * For production with multiple API server instances, replace with
 * a Redis-backed solution (e.g. @upstash/ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * @param maxRequests Maximum requests allowed within the window
   * @param windowMs Time window in milliseconds
   */
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodically clean up expired entries to prevent memory leaks
    setInterval(() => this.cleanup(), windowMs * 2).unref();
  }

  /**
   * Check if a request from the given key should be allowed.
   * @returns { allowed, remaining, retryAfterMs }
   */
  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, { timestamps: [now] });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterMs: 0 };
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = this.windowMs - (now - oldestInWindow);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Shared rate limiter instance: 10 uploads per minute per IP
export const uploadRateLimiter = new RateLimiter(10, 60 * 1000);
