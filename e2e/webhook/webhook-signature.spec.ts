import { test, expect } from "@playwright/test";
import crypto from "crypto";
import postgres from "postgres";
import dotenv from "dotenv";
import { makeSignature } from "@repo/commerce/webhook-signature";

dotenv.config({ path: ".env.local" });

test.skip(
  process.env.CI && process.env.E2E_WEBHOOK_TEST !== "1",
  "E2E_WEBHOOK_TEST no habilitado en el entorno (requiere env en Vercel + runner)"
);

const WEBHOOK_PATH = "/api/webhooks/mercadopago";
const MAGIC_APPROVED = "123456789";
const MAGIC_PENDING = "999999";
const TEST_EMAIL = "e2e-webhook@test.com";
const X_REQUEST_ID = "abc123";

test.describe("Webhook MercadoPago - firma", () => {
  let sql: ReturnType<typeof postgres>;
  let tenantId: string;
  const orderIds: string[] = [];

  test.beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!databaseUrl || !secret) {
      throw new Error(
        `Missing env for webhook E2E: DATABASE_URL=${databaseUrl ? "set" : "MISSING"}, MERCADOPAGO_WEBHOOK_SECRET=${secret ? "set" : "MISSING"}`
      );
    }

    sql = postgres(databaseUrl);
    const tenants = await sql<{ id: string }[]>`SELECT "id" FROM tenants WHERE slug = 'tienda1' LIMIT 1`;
    if (tenants.length === 0) {
      await sql.end();
      throw new Error("Tenant tienda1 not found (seed ausente)");
    }
    tenantId = tenants[0].id;

    for (let i = 0; i < 2; i++) {
      const orderId = crypto.randomUUID();
      orderIds.push(orderId);
      await sql`
        INSERT INTO orders ("id", "tenantId", "customerEmail", "status", "total", "currency", "shippingDetails")
        VALUES (${orderId}, ${tenantId}, ${TEST_EMAIL}, 'pending_payment', 0, 'UYU', '{}')
      `;
    }
  });

  test.afterAll(async () => {
    if (sql && orderIds.length > 0) {
      try {
        await sql`DELETE FROM orders WHERE "id" = ANY(${orderIds})`;
      } finally {
        await sql.end();
      }
    }
  });

  test("firma válida + pago aprobado → orden pasa a confirmed", async ({ request }) => {
    const orderId = orderIds[0];
    const ts = Math.floor(Date.now() / 1000);
    const signature = makeSignature({ dataId: MAGIC_APPROVED, ts, xRequestId: X_REQUEST_ID, secret: process.env.MERCADOPAGO_WEBHOOK_SECRET! });

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "x-signature": signature,
        "x-request-id": X_REQUEST_ID,
        "x-test-order-id": `${tenantId}:${orderId}`,
      },
      data: { type: "payment", data: { id: MAGIC_APPROVED } },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const rows = await sql<{ status: string }[]>`SELECT "status" FROM orders WHERE "id" = ${orderId}`;
    expect(rows[0]?.status).toBe("confirmed");
  });

  test("firma adulterada → 401", async ({ request }) => {
    const ts = Math.floor(Date.now() / 1000);
    const good = makeSignature({ dataId: MAGIC_APPROVED, ts, xRequestId: X_REQUEST_ID, secret: process.env.MERCADOPAGO_WEBHOOK_SECRET! });
    const tampered = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "x-signature": tampered,
        "x-request-id": X_REQUEST_ID,
        "x-test-order-id": `${tenantId}:${orderIds[0]}`,
      },
      data: { type: "payment", data: { id: MAGIC_APPROVED } },
    });

    expect(res.status()).toBe(401);
  });

  test("sin x-signature → 401", async ({ request }) => {
    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "x-request-id": X_REQUEST_ID,
        "x-test-order-id": `${tenantId}:${orderIds[0]}`,
      },
      data: { type: "payment", data: { id: MAGIC_APPROVED } },
    });

    expect(res.status()).toBe(401);
  });

  test("pago pending → la orden no cambia de estado", async ({ request }) => {
    const orderId = orderIds[1];
    const ts = Math.floor(Date.now() / 1000);
    const signature = makeSignature({ dataId: MAGIC_PENDING, ts, xRequestId: X_REQUEST_ID, secret: process.env.MERCADOPAGO_WEBHOOK_SECRET! });

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "x-signature": signature,
        "x-request-id": X_REQUEST_ID,
        "x-test-order-id": `${tenantId}:${orderId}`,
      },
      data: { type: "payment", data: { id: MAGIC_PENDING } },
    });

    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const rows = await sql<{ status: string }[]>`SELECT "status" FROM orders WHERE "id" = ${orderId}`;
    expect(rows[0]?.status).toBe("pending_payment");
  });
});
