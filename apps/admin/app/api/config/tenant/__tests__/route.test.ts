import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@repo/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("@repo/db", { db: undefined });

import { auth } from "@/lib/auth";
import { session } from "@repo/test-utils";
import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/config/tenant", () => {
  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autorizado");
  });

  it("should return 404 when tenant not found", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (db as any).select = mockDb.select;
    (db as any).from = mockDb.from;
    (db as any).where = mockDb.where;
    (db as any).limit = mockDb.limit;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Tenant no encontrado");
  });

  it("should return tenant data when found", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    const mockTenant = { id: "tenant-1", slug: "test-tenant", customDomain: null };
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockTenant]),
    };
    (db as any).select = mockDb.select;
    (db as any).from = mockDb.from;
    (db as any).where = mockDb.where;
    (db as any).limit = mockDb.limit;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("tenant-1");
    expect(body.slug).toBe("test-tenant");
  });
});
