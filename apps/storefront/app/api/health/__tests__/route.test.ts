import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@repo/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockDb = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  db: mockDb,
}));

vi.mock("@repo/commerce/redis", () => ({
  redisPing: vi.fn(),
}));

import { GET } from "../route";
import { redisPing } from "@repo/commerce/redis";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-test";
  mockDb.execute.mockResolvedValue({ rows: [] });
  vi.mocked(redisPing).mockResolvedValue(true);
});

afterEach(() => {
  delete process.env.REDIS_URL;
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
});

describe("GET /api/health (storefront)", () => {
  it("devuelve 200 ok cuando db, redis y MercadoPago responden", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({
      db: "ok",
      redis: "ok",
      mercadopago: "ok",
    });
    expect(body.app).toBe("storefront");
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it("devuelve 503 degraded cuando la db falla", async () => {
    mockDb.execute.mockRejectedValue(new Error("DB connection failed"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe("error");
  });

  it("devuelve 503 degraded cuando falta el token de MercadoPago", async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.mercadopago).toBe("missing");
  });

  it("devuelve redis skipped y 200 cuando falta REDIS_URL", async () => {
    delete process.env.REDIS_URL;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.redis).toBe("skipped");
  });
});