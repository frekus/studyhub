import Redis from "ioredis";

let instance: Redis | null = null;

export function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    enableOfflineQueue: true,   // Queue commands while connecting
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    commandTimeout: 3000,
    lazyConnect: false,         // Connect immediately on creation
  });
}

export function redis(): Redis {
  if (!instance) {
    instance = createRedisClient();
  }
  return instance;
}
