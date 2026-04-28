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
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  },
  dbShippingMethods: {},
}));

const createSelectChain = (result: any[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(result),
});

const createUpdateChain = (result: any[]) => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue(result),
});

const createDeleteChain = (count: number) => ({
  where: vi.fn().mockResolvedValue(count),
});

describe("GET /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const response = await GET({} as any, { params });

    expect(response.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]) as any);

    const { GET } = await import("../route");
    const params = Promise.resolve({ id: "unknown-id" });
    const response = await GET({} as any, { params });

    expect(response.status).toBe(404);
  });

  it("should return 200 with method when found", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const mockMethod = {
      id: "method-1",
      tenantId: "tenant-1",
      name: "Envío",
      price: 150,
    };

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockMethod]) as any);

    const { GET } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const response = await GET({} as any, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.method).toBeDefined();
  });
});

describe("PUT /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { PUT } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const request = {
      json: async () => ({ name: "Updated" }),
    } as any;
    const response = await PUT(request, { params });

    expect(response.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]) as any);

    const { PUT } = await import("../route");
    const params = Promise.resolve({ id: "unknown-id" });
    const request = {
      json: async () => ({ name: "Updated" }),
    } as any;
    const response = await PUT(request, { params });

    expect(response.status).toBe(404);
  });

  it("should return 200 with updated method when valid", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const mockMethod = {
      id: "method-1",
      tenantId: "tenant-1",
      name: "Envío",
      price: 150,
    };

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockMethod]) as any);
    vi.mocked(db.update).mockReturnValueOnce(createUpdateChain([mockMethod]) as any);

    const { PUT } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const request = {
      json: async () => ({ name: "Envío actualizado" }),
    } as any;
    const response = await PUT(request, { params });

    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const { DELETE } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const response = await DELETE({} as any, { params });

    expect(response.status).toBe(401);
  });

  it("should return 404 when method not found", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([]) as any);

    const { DELETE } = await import("../route");
    const params = Promise.resolve({ id: "unknown-id" });
    const response = await DELETE({} as any, { params });

    expect(response.status).toBe(404);
  });

  it("should return 204 when successfully deleted", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { tenantId: "tenant-1" },
    } as any);

    const mockMethod = {
      id: "method-1",
      tenantId: "tenant-1",
      name: "Envío",
    };

    const { db } = await import("@repo/db");
    vi.mocked(db.select).mockReturnValueOnce(createSelectChain([mockMethod]) as any);
    vi.mocked(db.delete).mockReturnValueOnce(createDeleteChain(1) as any);

    const { DELETE } = await import("../route");
    const params = Promise.resolve({ id: "method-1" });
    const response = await DELETE({} as any, { params });

    expect(response.status).toBe(204);
  });
});