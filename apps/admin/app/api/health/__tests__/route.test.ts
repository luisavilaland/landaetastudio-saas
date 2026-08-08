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

const mockCaptureMessage = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nextjs", () => ({
  captureMessage: mockCaptureMessage,
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
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

describe("GET /api/health (admin)", () => {
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
    expect(body.app).toBe("admin");
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

  it("notifica a Sentry cuando el check degrada y hay DSN configurado", async () => {
    process.env.SENTRY_DSN = "https://xxx@xxx.ingest.sentry.io/xxx";
    mockDb.execute.mockRejectedValue(new Error("DB connection failed"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(mockCaptureMessage).toHaveBeenCalledOnce();
    expect(mockCaptureMessage.mock.calls[0][0]).toContain("Health check degraded");
    expect(mockCaptureMessage.mock.calls[0][1].level).toBe("warning");
  });

  it("no notifica a Sentry cuando el health está ok", async () => {
    process.env.SENTRY_DSN = "https://sentry@xxx.ingest.sentry.io/xxx";

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});