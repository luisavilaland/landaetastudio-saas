import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redisClient.on("error", (err) => {
  console.error("[Redis] Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("[Redis] Connected");
});