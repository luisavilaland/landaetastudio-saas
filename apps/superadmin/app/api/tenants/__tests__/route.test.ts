import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redisClient: {
    del: vi.fn().mockResolvedValue(0),
  },
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

import { db } from "@repo/db";
import { auth } from "@/lib/auth";
import { mockReq } from "@repo/test-utils";
import { GET, POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockQuery<T>(resolveValue: T[]): any {
  const q = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    orderBy: vi.fn().mockResolvedValue(resolveValue),
    then: (onFulfilled: (v: T[]) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled),
  };
  return q;
}

const MOCK_TENANT = {
  id: "tenant-1",
  slug: "test-store",
  name: "Test Store",
  plan: "starter",
  status: "active",
  customDomain: null,
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const superadminSession: Record<string, unknown> = {
  user: { email: "super@admin.com", role: "superadmin" },
  expires: "2099-01-01T00:00:00.000Z",
};

const adminSession: Record<string, unknown> = {
  user: { email: "admin@store.com", role: "admin" },
  expires: "2099-01-01T00:00:00.000Z",
};

describe("GET /api/tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("should return 403 when user is not superadmin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(adminSession);

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("should return 200 with tenant list for superadmin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(superadminSession);

    vi.mocked(db.select).mockReturnValueOnce(mockQuery([MOCK_TENANT]));

    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("tenants");
    expect(data.tenants).toHaveLength(1);
  });
});

describe("POST /api/tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 when user is not superadmin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(adminSession);

    const res = await POST(mockReq("POST",{ slug: "new-store", name: "New Store", plan: "starter", status: "active" }));

    expect(res.status).toBe(403);
  });

  it("should return 201 when superadmin creates tenant", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(superadminSession);

    vi.mocked(db.select).mockReturnValueOnce(mockQuery([]));
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([MOCK_TENANT]),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await POST(mockReq("POST",{ slug: "test-store", name: "Test Store", plan: "starter", status: "active" }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.slug).toBe("test-store");
  });

  it("should return 409 when slug already exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(superadminSession);

    vi.mocked(db.select).mockReturnValueOnce(mockQuery([MOCK_TENANT]));

    const res = await POST(mockReq("POST",{ slug: "test-store", name: "Test Store", plan: "starter", status: "active" }));

    expect(res.status).toBe(409);
  });

  it("should return 400 when name is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(superadminSession);

    const res = await POST(mockReq("POST",{ slug: "test-store" }));

    expect(res.status).toBe(400);
  });

  it("should return 400 when slug is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(superadminSession);

    const res = await POST(mockReq("POST",{ name: "Test Store" }));

    expect(res.status).toBe(400);
  });

  it("should return 401 when no session", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue(null);

    const res = await POST(mockReq("POST",{ slug: "test-store", name: "Test Store", plan: "starter", status: "active" }));

    expect(res.status).toBe(401);
  });
});
