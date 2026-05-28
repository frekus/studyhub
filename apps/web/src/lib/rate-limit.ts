import { redis } from "@studyhub/cache";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Sliding window rate limiter using Redis.
 * key    — unique identifier (IP, user ID, etc.)
 * limit  — max requests allowed
 * window — window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    // Use Redis pipeline for atomic operations
    const multi = redis.multi();
    multi.zremrangebyscore(redisKey, 0, now - windowMs);  // Remove old entries
    multi.zadd(redisKey, now, `${now}-${Math.random()}`); // Add current request
    multi.zcard(redisKey);                                 // Count requests
    multi.expire(redisKey, windowSeconds);                 // Set TTL

    const results = await multi.exec();
    const count = (results?.[2] as number) ?? 0;

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetInSeconds = windowSeconds;

    return { allowed, remaining, resetInSeconds };
  } catch {
    // If Redis is down, fail open (allow request) to avoid blocking users
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

/**
 * Get client IP from request headers (works behind Nginx proxy)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Standard rate limit error response
 */
export function rateLimitResponse(resetInSeconds: number, context?: string): Response {
  const minutes = Math.ceil(resetInSeconds / 60);
  const hours   = Math.ceil(resetInSeconds / 3600);

  const timeLabel =
    resetInSeconds < 60   ? `${resetInSeconds} seconds` :
    resetInSeconds < 3600 ? `${minutes} minute${minutes !== 1 ? "s" : ""}` :
                             `${hours} hour${hours !== 1 ? "s" : ""}`;

  const contextMsg = context ? ` ${context}` : "";

  return new Response(
    JSON.stringify({
      data: null,
      error: `Too many requests.${contextMsg} Please wait ${timeLabel} before trying again.`,
      status: 429,
      resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resetInSeconds),
        "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + resetInSeconds),
      },
    }
  );
}
