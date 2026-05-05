import Redis from "ioredis";
import { createLogger } from "@repo/logger";

const logger = createLogger("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redisClient.on("error", (err) => {
  logger.error({ error: err.message }, "Redis error");
});

redisClient.on("connect", () => {
  logger.info("Redis connected");
});
