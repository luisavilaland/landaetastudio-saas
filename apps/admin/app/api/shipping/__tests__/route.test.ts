import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  dbShippingMethods: {},
}));

const createSelectChain = (result: any[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(result),
});

const createInsertChain = (result: any[]) => ({
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue(result),
});

describe("GET /api/shipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("should return 200 with methods array when authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]) as any);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.methods).toEqual([]);
  });
});

describe("POST /api/shipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const request = {
      json: async () => ({ name: "Envío", price: 150 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 201 with created method when valid data", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const mockMethod = {
      id: "method-1",
      tenantId: "tenant-1",
      name: "Envío",
      price: 150,
      isActive: "true",
    };

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]) as any);
    vi.mocked(db.insert).mockReturnValueOnce(createInsertChain([mockMethod]) as any);

    const { POST } = await import("../route");
    const request = {
      json: async () => ({ name: "Envío", price: 150 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.method).toBeDefined();
  });

  it("should return 400 with validation errors when invalid data", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const { POST } = await import("../route");
    const request = {
      json: async () => ({ name: "", price: -10 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
  });
});