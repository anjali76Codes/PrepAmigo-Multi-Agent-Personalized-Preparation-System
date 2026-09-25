import { Redis } from "ioredis";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

// Main Redis instance for general commands (fetching replay history, etc.)
export const redisClient: Redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redisClient.on("connect", () => {
  logger.info("[Redis] Successfully connected to Redis server");
});

redisClient.on("error", (err: Error) => {
  logger.error("[Redis] Client error:", err);
});

// Factory function to create dedicated subscriber connections for SSE streams
export function createRedisSubscriber(): Redis {
  const sub = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  sub.on("error", (err: Error) => {
    logger.error("[Redis Subscriber] Connection error:", err);
  });

  return sub;
}
