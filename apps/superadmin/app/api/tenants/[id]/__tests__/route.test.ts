import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redisClient: {
    del: vi.fn().mockResolvedValue(0),
    setex: vi.fn().mockResolvedValue("OK"),
  },
}));

import { auth } from "@/lib/auth";
import { PUT } from "../route";

const mockSession = {
  user: { email: "super@admin.com" },
  expires: "2099-01-01T00:00:00.000Z",
};

function makeRequest(id: string, body: Record<string, unknown>) {
  return PUT(
    {
      json: async () => body,
    } as any,
    { params: Promise.resolve({ id }) }
  );
}

describe("PUT /api/tenants/[id]", () => {
  let testTenantId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const [tenant] = await db
      .insert(dbTenants)
      .values({
        slug: "test-tenant-domain",
        name: "Test Tenant",
        plan: "starter",
        status: "active",
      })
      .returning({ id: dbTenants.id });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    await db.delete(dbTenants).where(eq(dbTenants.id, testTenantId));
    await db.delete(dbTenants).where(eq(dbTenants.slug, "other-tenant"));
  });

  it("should update customDomain with valid domain", async () => {
    const res = await makeRequest(testTenantId, { customDomain: "mitienda.com.uy" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBe("mitienda.com.uy");
  });

  it("should reject invalid domain format", async () => {
    const res = await makeRequest(testTenantId, { customDomain: "http://mitienda.com" });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate customDomain", async () => {
    await db.insert(dbTenants).values({
      slug: "other-tenant",
      name: "Other Tenant",
      customDomain: "existing.com",
    });

    const res = await makeRequest(testTenantId, { customDomain: "existing.com" });

    expect(res.status).toBe(409);

    const [other] = await db
      .select({ id: dbTenants.id })
      .from(dbTenants)
      .where(eq(dbTenants.slug, "other-tenant"));
    await db.delete(dbTenants).where(eq(dbTenants.id, other.id));
  });

  it("should clear customDomain when empty string", async () => {
    await db
      .update(dbTenants)
      .set({ customDomain: "mitienda.com" })
      .where(eq(dbTenants.id, testTenantId));

    const res = await makeRequest(testTenantId, { customDomain: "" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBeNull();
  });
});
