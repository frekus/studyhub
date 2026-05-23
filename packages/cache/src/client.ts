import Redis from "ioredis";

let instance: Redis | null = null;

export function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    // Fail commands immediately when not connected instead of queuing them.
    // Without this, a down Redis server hangs every request until timeout.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
}

export function redis(): Redis {
  if (!instance) {
    instance = createRedisClient();
  }
  return instance;
}
