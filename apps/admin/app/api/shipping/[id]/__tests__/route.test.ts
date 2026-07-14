import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShippingMethod } from "@repo/db";
import { db } from "@repo/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    db: {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { auth } from "@/lib/auth";
import { GET, PUT, DELETE } from "../route";

function makeGETRequest(id: string) {
  return GET(
    {
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof GET>[0],
    { params: Promise.resolve({ id }) },
  );
}

function makePUTRequest(id: string, body: Record<string, unknown>) {
  return PUT(
    {
      json: async () => body,
      nextUrl: new URL("http://localhost"),
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as unknown as Parameters<typeof PUT>[0],
    { params: Promise.resolve({ id }) },
  );
}

function makeDELETERequest(id: string) {
  return DELETE(
    {
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof DELETE>[0],
    { params: Promise.resolve({ id }) },
  );
}

const mockId = "shipping-test-id";
const sessionTenant = "tenant-a";
const otherTenant = "tenant-b";

const mockMethod: ShippingMethod = {
  id: mockId,
  tenantId: sessionTenant,
  name: "Standard Shipping",
  description: "Standard delivery",
  price: 500,
  freeShippingThreshold: 50000,
  estimatedDaysMin: 3,
  estimatedDaysMax: 7,
  isActive: "true",
  sortOrder: 1,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

describe("GET /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await makeGETRequest(mockId);
    expect(res.status).toBe(401);
  });

  it("should return 404 for cross-tenant access", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: "admin@b.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof db.select>);

    const res = await makeGETRequest(mockId);
    expect(res.status).toBe(404);
  });

  it("should return 200 with method", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: "admin@test.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMethod]),
    } as unknown as ReturnType<typeof db.select>);

    const res = await makeGETRequest(mockId);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.method.id).toBe(mockId);
    expect(data.method.name).toBe("Standard Shipping");
    expect(data.method.price).toBe(500);
  });
});

describe("PUT /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await makePUTRequest(mockId, { name: "Express" });
    expect(res.status).toBe(401);
  });

  it("should return 404 for cross-tenant access", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: "admin@b.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof db.select>);

    const res = await makePUTRequest(mockId, { name: "Express" });
    expect(res.status).toBe(404);
  });

  it("should return 400 for invalid body", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: "admin@test.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMethod]),
    } as unknown as ReturnType<typeof db.select>);

    const res = await makePUTRequest(mockId, { price: -100 });
    expect(res.status).toBe(400);
  });

  it("should return 200 on successful update", async () => {
    const updatedMethod = { ...mockMethod, name: "Express Shipping" };

    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: "admin@test.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMethod]),
    } as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedMethod]),
        }),
      }),
    } as unknown as ReturnType<typeof db.update>);

    const res = await makePUTRequest(mockId, { name: "Express Shipping" });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.method.name).toBe("Express Shipping");
  });
});

describe("DELETE /api/shipping/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await makeDELETERequest(mockId);
    expect(res.status).toBe(401);
  });

  it("should return 404 for cross-tenant access", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: otherTenant, email: "admin@b.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof db.select>);

    const res = await makeDELETERequest(mockId);
    expect(res.status).toBe(404);
  });

  it("should return 204 on successful delete", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: sessionTenant, email: "admin@test.com" },
    });
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMethod]),
    } as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValueOnce({
      where: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.delete>);

    const res = await makeDELETERequest(mockId);
    expect(res.status).toBe(204);
  });
});
