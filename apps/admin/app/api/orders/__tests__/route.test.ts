import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenantContext } from "@repo/db";
import { makeTxMock, session, mockReq } from "@repo/test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, withTenantContext: vi.fn(), db: undefined };
});

import { auth } from "@/lib/auth";
import { GET } from "../route";

function mockOrdersReq(urlStr: string) {
  const req = mockReq("GET");
  (req as any).nextUrl = new URL(urlStr);
  (req as any).url = urlStr;
  return req;
}

function mockOrdersTx() {
  const tx = makeTxMock({
    select: [
      {
        data: [
          {
            id: "order-1",
            customerId: "cust-1",
            customerEmail: "test@test.com",
            total: 50000,
            status: "confirmed",
            createdAt: new Date("2026-01-15"),
            updatedAt: new Date("2026-01-15"),
          },
        ],
        terminal: "orderBy",
      },
    ],
  });
  tx.leftJoin = vi.fn().mockReturnValue(tx);
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/orders", () => {
  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(mockOrdersReq("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autorizado");
  });

  it("should return 400 when tenant not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} as any, expires: "2099-01-01" });

    const response = await GET(mockOrdersReq("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Tenant no encontrado");
  });

  it("should return orders with correct structure", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(mockOrdersTx()));

    const response = await GET(mockOrdersReq("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("order-1");
    expect(body[0].total).toBe(50000);
    expect(body[0].status).toBe("confirmed");
  });

  it("should use cents (integer) for total", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(mockOrdersTx()));

    const response = await GET(mockOrdersReq("http://localhost"));
    const body = await response.json();

    expect(Number.isInteger(body[0].total)).toBe(true);
  });

  it("should filter by status parameter", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => {
      const tx = makeTxMock({ select: [{ data: [], terminal: "orderBy" }] });
      tx.leftJoin = vi.fn().mockReturnValue(tx);
      return cb(tx);
    });

    const response = await GET(mockOrdersReq("http://localhost?status=pending_payment"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(0);
  });

  it("should ignore invalid status parameter", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(mockOrdersTx()));

    const response = await GET(mockOrdersReq("http://localhost?status=invalid_status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });
});
