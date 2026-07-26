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

import type { NextRequest } from "next/server";
import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
});

function makeReq(domain: string | null): NextRequest {
  const url = domain ? `http://localhost?domain=${domain}` : "http://localhost";
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

describe("GET /api/domain-check (superadmin)", () => {
  it("should return 400 when domain param is missing", async () => {
    const response = await GET(makeReq(null));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Domain parameter is required");
  });

  it("should return 400 when domain param is empty", async () => {
    const response = await GET(makeReq(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Domain parameter is required");
  });

  it("should return available=true when domain not taken", async () => {
    mockDb.limit.mockResolvedValue([]);

    const response = await GET(makeReq("mitienda.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.domain).toBe("mitienda.com");
  });

  it("should return available=false when domain already taken", async () => {
    mockDb.limit.mockResolvedValue([{ id: "tenant-1" }]);

    const response = await GET(makeReq("mitienda.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(false);
    expect(body.domain).toBe("mitienda.com");
  });
});
