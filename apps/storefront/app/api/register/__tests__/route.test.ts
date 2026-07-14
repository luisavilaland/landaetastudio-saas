import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({
  getTenantId: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    db: { select: vi.fn(), insert: vi.fn() },
  };
});

vi.mock("bcryptjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bcryptjs")>();
  return {
    ...actual,
    default: { hash: vi.fn().mockResolvedValue("hashed-password") },
    hash: vi.fn().mockResolvedValue("hashed-password"),
  };
});

vi.mock("@repo/commerce", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { NextRequest } from "next/server";
import { db } from "@repo/db";
import { getTenantId } from "@/lib/tenant";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@repo/commerce";
import { POST } from "../route";

const TENANT_ID = "tenant-123";
const CROSS_TENANT_ID = "tenant-b";

function createQuery<T>(resolveValue: T[]): any {
  const q = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    then: (onFulfilled: (v: T[]) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled),
  };
  return q;
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ "content-type": "application/json" }),
    nextUrl: new URL("http://localhost"),
  } as unknown as NextRequest;
}

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  it("debe devolver 400 cuando el email es inválido", async () => {
    const res = await POST(
      makeRequest({ name: "Test User", email: "invalido", password: "password123" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validación fallida");
  });

  it("debe devolver 400 cuando no hay tenant", async () => {
    vi.mocked(getTenantId).mockResolvedValue(null);

    const res = await POST(
      makeRequest({ name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Tienda no encontrada");
  });

  it("debe devolver 409 cuando el email ya existe en el mismo tenant", async () => {
    vi.mocked(db.select).mockReturnValueOnce(createQuery([{ id: "customer-1" }]));

    const res = await POST(
      makeRequest({ name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Email ya registrado");
    expect(body.field).toBe("email");
  });

  it("debe crear el usuario cuando el email existe en otro tenant (cross-tenant)", async () => {
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID);
    vi.mocked(db.select)
      .mockReturnValueOnce(createQuery([]))
      .mockReturnValueOnce(createQuery([{ name: "Test Store" }]));
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);

    const res = await POST(
      makeRequest({ name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("debe crear el usuario exitosamente y enviar email de bienvenida", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(createQuery([]))
      .mockReturnValueOnce(createQuery([{ name: "Test Store" }]));
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);

    const res = await POST(
      makeRequest({ name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(201);
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      "test@test.com",
      "Test User",
      "Test Store",
      undefined
    );
  });
});
