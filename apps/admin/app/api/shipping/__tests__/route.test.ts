import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
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

import { auth } from "@/lib/auth";
import { db } from "@repo/db";

const createSelectChain = (result: any[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(result),
});

const createInsertChain = (result: any[]) => ({
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue(result),
});

async function importGet() {
  const mod = await import("../route");
  return mod.GET;
}

async function importPost() {
  const mod = await import("../route");
  return mod.POST;
}

describe("GET /api/shipping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const GET = await importGet();
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("should return 200 with methods array when authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: "tenant-1" },
    } as any);

    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);

    const GET = await importGet();
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
    vi.mocked(auth).mockResolvedValue(null);

    const POST = await importPost();
    const request = {
      json: async () => ({ name: "Envío", price: 150 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 201 with created method when valid data", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: "tenant-1" },
    } as any);

    const mockMethod = {
      id: "method-1",
      tenantId: "tenant-1",
      name: "Envío",
      price: 150,
      isActive: "true",
    };

    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);
    vi.mocked(db.insert).mockReturnValue(createInsertChain([mockMethod]) as any);

    const POST = await importPost();
    const request = {
      json: async () => ({ name: "Envío", price: 150 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.method).toBeDefined();
  });

  it("should return 400 with validation errors when invalid data", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { tenantId: "tenant-1" },
    } as any);

    const POST = await importPost();
    const request = {
      json: async () => ({ name: "", price: -10 }),
    } as any;
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
  });
});
