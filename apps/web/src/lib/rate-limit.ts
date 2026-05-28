import { redis as getRedis } from "@studyhub/cache";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

async function getConnectedClient() {
  const client = getRedis();
  // Connect explicitly if not already connected
  if (client.status === "wait" || client.status === "close") {
    await client.connect().catch(() => {});
  }
  return client;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const client = await getConnectedClient();

    // Atomic sliding window using pipeline
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(redisKey);
    pipeline.expire(redisKey, windowSeconds);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetInSeconds: windowSeconds,
    };
  } catch (e) {
    // Redis unavailable — fail open to avoid blocking users
    console.error("[rate-limit] Redis error:", e);
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

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
      },
    }
  );
}
