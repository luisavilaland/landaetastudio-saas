import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
}));

vi.mock("@repo/db", () => ({
  db: mockDb,
  dbTenants: {},
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
});

describe("GET /api/domain-check", () => {
  it("should return 400 when domain param is missing", async () => {
    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("El parámetro domain es requerido");
  });

  it("should return 400 when domain param is empty", async () => {
    const response = await GET(new Request("http://localhost?domain="));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("El parámetro domain es requerido");
  });

  it("should return available=true when domain not taken", async () => {
    mockDb.limit.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost?domain=mitienda.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
  });

  it("should return available=false when domain already taken", async () => {
    mockDb.limit.mockResolvedValue([{ id: "tenant-1" }]);

    const response = await GET(new Request("http://localhost?domain=mitienda.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(false);
  });
});
