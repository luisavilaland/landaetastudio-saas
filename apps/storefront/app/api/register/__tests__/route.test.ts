import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  return { ...actual, withTenantContext: vi.fn() };
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

import { withTenantContext } from "@repo/db";
import { makeTxMock, mockReq } from "@repo/test-utils";
import { getTenantId } from "@/lib/tenant";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@repo/commerce";
import { POST } from "../route";

const TENANT_ID = "tenant-123";
const CROSS_TENANT_ID = "tenant-b";

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(getTenantId).mockResolvedValue(TENANT_ID);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("debe devolver 400 cuando el email es inválido", async () => {
    const res = await POST(
      mockReq("POST", { name: "Test User", email: "invalido", password: "password123" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validación fallida");
  });

  it("debe devolver 400 cuando no hay tenant", async () => {
    vi.mocked(getTenantId).mockResolvedValue(null);

    const res = await POST(
      mockReq("POST", { name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Tienda no encontrada");
  });

  it("debe devolver 409 cuando el email ya existe en el mismo tenant", async () => {
    const tx = makeTxMock({ select: [{ data: [{ id: "customer-1" }], terminal: "limit" }, { data: [{ name: "Test Store" }], terminal: "limit" }] });
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(tx));

    const res = await POST(
      mockReq("POST", { name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Email ya registrado");
    expect(body.field).toBe("email");
    expect(withTenantContext).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
  });

  it("debe crear el usuario cuando el email existe en otro tenant (cross-tenant)", async () => {
    vi.mocked(getTenantId).mockResolvedValue(CROSS_TENANT_ID);
    const readTx = makeTxMock({ select: [{ data: [], terminal: "limit" }, { data: [{ name: "Test Store" }], terminal: "limit" }] });
    const insertTx = makeTxMock();
    insertTx.insert.mockReturnValue(insertTx);
    insertTx.values.mockResolvedValue(undefined);
    const mockCalls = [readTx, insertTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const res = await POST(
      mockReq("POST", { name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });

  it("debe crear el usuario exitosamente y enviar email de bienvenida", async () => {
    const readTx = makeTxMock({ select: [{ data: [], terminal: "limit" }, { data: [{ name: "Test Store" }], terminal: "limit" }] });
    const insertTx = makeTxMock();
    insertTx.insert.mockReturnValue(insertTx);
    insertTx.values.mockResolvedValue(undefined);
    const mockCalls = [readTx, insertTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const res = await POST(
      mockReq(
        "POST",
        { name: "Test User", email: "test@test.com", password: "password123" },
        { host: "tienda1.landaetastudio.com", "x-forwarded-proto": "https" }
      )
    );

    expect(res.status).toBe(201);
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      "test@test.com",
      "Test User",
      "Test Store",
      "https://tienda1.landaetastudio.com"
    );
    expect(withTenantContext).toHaveBeenCalledTimes(2);
  });

  it("debe devolver 409 cuando el insert falla por unique violation (23505)", async () => {
    const readTx = makeTxMock({ select: [{ data: [], terminal: "limit" }, { data: [{ name: "Test Store" }], terminal: "limit" }] });
    const insertTx = makeTxMock();
    insertTx.insert.mockReturnValue(insertTx);
    insertTx.values.mockRejectedValue({ code: "23505" });

    const mockCalls = [readTx, insertTx];
    let callIndex = 0;
    vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(mockCalls[callIndex++]));

    const res = await POST(
      mockReq("POST", { name: "Test User", email: "test@test.com", password: "password123" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Email ya registrado");
    expect(body.field).toBe("email");
  });
});
