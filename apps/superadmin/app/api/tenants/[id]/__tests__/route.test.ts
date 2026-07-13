import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tenant } from "@repo/db";
import { db } from "@repo/db";

vi.mock("@repo/auth", () => ({
  superadminAuthFn: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redisClient: {
    del: vi.fn().mockResolvedValue(0),
    setex: vi.fn().mockResolvedValue("OK"),
  },
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    db: {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { superadminAuthFn as auth } from "@repo/auth";
import { GET, PUT, DELETE } from "../route";

const mockSession: Record<string, unknown> = {
  user: { email: "super@admin.com", role: "superadmin" },
  expires: "2099-01-01T00:00:00.000Z",
};

function makePUTRequest(id: string, body: Record<string, unknown>) {
  return PUT(
    {
      json: async () => body,
      nextUrl: new URL("http://localhost"),
      cookies: { get: () => undefined },
      headers: new Headers(),
    } as Parameters<typeof PUT>[0],
    { params: Promise.resolve({ id }) }
  );
}

const baseTenant: Tenant = {
  id: "test-tenant-id",
  slug: "test-tenant-domain",
  name: "Test Tenant",
  plan: "starter",
  status: "active",
  customDomain: null,
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/tenants/[id] — Role Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 when user is not superadmin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { email: "admin@store.com", role: "admin" } });

    const req = {
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof GET>[0];
    const params: Parameters<typeof GET>[1] = { params: Promise.resolve({ id: "test-tenant-id" }) };
    const res = await GET(req, params);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/tenants/[id] — Role Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 when user is not superadmin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { email: "admin@store.com", role: "admin" } });

    const req = {
      nextUrl: new URL("http://localhost"),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof DELETE>[0];
    const params: Parameters<typeof DELETE>[1] = { params: Promise.resolve({ id: "test-tenant-id" }) };
    const res = await DELETE(req, params);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/tenants/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(mockSession);
  });

  it("should update customDomain with valid domain", async () => {
    const existingTenant = { ...baseTenant };
    const updatedTenant = { ...baseTenant, customDomain: "mitienda.com.uy" };

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([existingTenant]),
      } as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof db.select>);

    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedTenant]),
        }),
      }),
    } as unknown as ReturnType<typeof db.update>);

    const res = await makePUTRequest("test-tenant-id", { customDomain: "mitienda.com.uy" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBe("mitienda.com.uy");
  });

  it("should reject invalid domain format", async () => {
    const res = await makePUTRequest("test-tenant-id", { customDomain: "http://mitienda.com" });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate customDomain", async () => {
    const existingTenant = { ...baseTenant };
    const duplicateTenant = { ...baseTenant, id: "other-tenant-id", customDomain: "existing.com" };

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([existingTenant]),
      } as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([duplicateTenant]),
      } as unknown as ReturnType<typeof db.select>);

    const res = await makePUTRequest("test-tenant-id", { customDomain: "existing.com" });

    expect(res.status).toBe(409);
  });

  it("should clear customDomain when empty string", async () => {
    const existingTenant = { ...baseTenant, customDomain: "mitienda.com" };
    const updatedTenant = { ...baseTenant, customDomain: null };

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([existingTenant]),
    } as unknown as ReturnType<typeof db.select>);

    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedTenant]),
        }),
      }),
    } as unknown as ReturnType<typeof db.update>);

    const res = await makePUTRequest("test-tenant-id", { customDomain: "" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBeNull();
  });
});
