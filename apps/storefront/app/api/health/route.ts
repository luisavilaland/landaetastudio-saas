import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@repo/db";
import { redisPing } from "@repo/commerce/redis";
import { createLogger } from "@repo/logger";

export const dynamic = "force-dynamic";

const logger = createLogger("health");

const APP_NAME = "storefront";
const CHECK_TIMEOUT_MS = 4000;

type CheckStatus = "ok" | "error" | "skipped" | "missing";

function timeoutPromise(): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Health check timed out after ${CHECK_TIMEOUT_MS}ms`)),
      CHECK_TIMEOUT_MS
    );
  });
}

async function withTimeout<T>(check: () => Promise<T>): Promise<T> {
  return await Promise.race([check(), timeoutPromise()]);
}

async function checkDb(): Promise<CheckStatus> {
  try {
    await withTimeout(async () => {
      await db.execute(sql`SELECT 1`);
    });
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<CheckStatus> {
  if (!process.env.REDIS_URL) return "skipped";
  try {
    const alive = await withTimeout(async () => redisPing());
    return alive ? "ok" : "error";
  } catch {
    return "error";
  }
}

function checkMercadoPago(): CheckStatus {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ? "ok" : "missing";
}

export async function GET() {
  const timestamp = new Date().toISOString();

  const checks = {
    db: await checkDb(),
    redis: await checkRedis(),
    mercadopago: checkMercadoPago(),
  };

  const degraded = Object.values(checks).some(
    (status) => status === "error" || status === "missing"
  );

  if (degraded) {
    logger.warn({ app: APP_NAME, checks }, "Health check degraded");
  }

  return NextResponse.json(
    { status: degraded ? "degraded" : "ok", checks, app: APP_NAME, timestamp },
    { status: degraded ? 503 : 200 }
  );
}