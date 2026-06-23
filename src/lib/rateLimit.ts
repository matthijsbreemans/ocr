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
  private readonly maxKeys: number;

  /**
   * @param maxRequests Maximum requests allowed within the window
   * @param windowMs Time window in milliseconds
   * @param maxKeys Hard cap on tracked keys, to bound memory against a flood of
   *   distinct (e.g. spoofed X-Forwarded-For) IPs between cleanup ticks
   */
  constructor(maxRequests: number, windowMs: number, maxKeys = 100_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;

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
      // Bound memory: if we're at capacity for new keys, prune expired entries
      // first, then evict the oldest-inserted key if still full.
      if (this.store.size >= this.maxKeys) {
        this.cleanup();
        if (this.store.size >= this.maxKeys) {
          const oldest = this.store.keys().next().value;
          if (oldest !== undefined) this.store.delete(oldest);
        }
      }
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

// Shared rate limiter instance: 10 uploads per minute per IP by default.
// Override with UPLOAD_RATE_LIMIT (e.g. for E2E test runs, which fire more
// than 10 uploads per minute and would otherwise fail nondeterministically).
const maxUploadsPerMinute = Number(process.env.UPLOAD_RATE_LIMIT) || 10;
export const uploadRateLimiter = new RateLimiter(maxUploadsPerMinute, 60 * 1000);
