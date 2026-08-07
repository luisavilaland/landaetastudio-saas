import Redis from "ioredis";
import { createLogger } from "@repo/logger";

const logger = createLogger("redis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on("error", (err) => {
  logger.error({ error: err.message }, "Redis error");
});

redisClient.on("connect", () => {
  logger.info("Redis connected");
});

function redisDown(operation: string, error: unknown): void {
  logger.warn({ operation, error }, "Redis unavailable, degrading gracefully");
}

/**
 * Wrappers "progresivos": si Redis no responde, degradan (null / no-op + warn)
 * en lugar de lanzar. Evita que un servicio externo caído tire 500 en los
 * flujos de carrito; el carrito simplemente se trata como vacío.
 */
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch (error) {
    redisDown("get", error);
    return null;
  }
}

export async function redisSetEx(
  key: string,
  seconds: number,
  value: string
): Promise<void> {
  try {
    await redisClient.setex(key, seconds, value);
  } catch (error) {
    redisDown("setex", error);
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (error) {
    redisDown("del", error);
  }
}
