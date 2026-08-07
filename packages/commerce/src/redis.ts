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

/**
 * Espera (con tope) a que la conexión esté "ready" antes de emitir un comando.
 * Con `lazyConnect` + `enableOfflineQueue:false`, el primer comando en un
 * cold-start se dispara mientras el socket aún está conectando y se rechaza
 * con `ECONNREFUSED`/`Connection is closed`, perdiendo el write en silencio
 * (carrito que no guarda). Con `whenReady` el comando se emite solo cuando la
 * conexión está lista; si nunca llega a estarlo, se degrada tras el timeout.
 */
async function whenReady(timeoutMs = 5000): Promise<void> {
  const status = redisClient.status;
  if (status === "ready") return;
  if (status === "wait" || status === "end") {
    redisClient.connect().catch(() => {});
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      redisClient.off("ready", onReady);
      reject(
        new Error(
          `Redis not ready after ${timeoutMs}ms (status: ${redisClient.status})`
        )
      );
    }, timeoutMs);
    function onReady(): void {
      clearTimeout(timer);
      resolve();
    }
    redisClient.once("ready", onReady);
  });
}

async function redisDown(operation: string, error: unknown): Promise<void> {
  logger.warn({ operation, error }, "Redis unavailable, degrading gracefully");
  try {
    const { captureMessage } = await import("@sentry/nextjs");
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      captureMessage(`Redis unavailable during "${operation}"`, {
        level: "warning",
        extra: { operation, error: String(error) },
      });
    }
  } catch {
    // Sentry no disponible (tests / sin DSN): la degradación ya quedó logueada.
  }
}

/**
 * Wrappers "progresivos": si Redis no responde, degradan (null / no-op + warn)
 * en lugar de lanzar. Evita que un servicio externo caído tire 500 en los
 * flujos de carrito; el carrito simplemente se trata como vacío.
 */
async function safeRun<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    await whenReady();
    return await fn();
  } catch (error) {
    await redisDown(operation, error);
    return null;
  }
}

export async function safeGet(key: string): Promise<string | null> {
  return safeRun("get", () => redisClient.get(key));
}

export async function redisSetEx(
  key: string,
  seconds: number,
  value: string
): Promise<void> {
  await safeRun("setex", () => redisClient.setex(key, seconds, value));
}

export async function redisDel(key: string): Promise<void> {
  await safeRun("del", () => redisClient.del(key));
}
