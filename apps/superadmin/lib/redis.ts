import { createLogger } from "@repo/logger";
import Redis from "ioredis";

const logger = createLogger("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redisClient.on("error", (err) => {
  logger.error("[Redis] Error: " + err.message);
});