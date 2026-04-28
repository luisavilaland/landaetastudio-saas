import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

describe("PUT /api/tenants/[id]", () => {
  let testTenantId: string;

  beforeEach(async () => {
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
  });

  it("should update customDomain with valid domain", async () => {
    const res = await fetch(`http://localhost:3001/api/tenants/${testTenantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomain: "mitienda.com.uy" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBe("mitienda.com.uy");
  });

  it("should reject invalid domain format", async () => {
    const res = await fetch(`http://localhost:3001/api/tenants/${testTenantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomain: "http://mitienda.com" }),
    });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate customDomain", async () => {
    await db.insert(dbTenants).values({
      slug: "other-tenant",
      name: "Other Tenant",
      customDomain: "existing.com",
    });

    const res = await fetch(`http://localhost:3001/api/tenants/${testTenantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomain: "existing.com" }),
    });

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

    const res = await fetch(`http://localhost:3001/api/tenants/${testTenantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomain: "" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.customDomain).toBeNull();
  });
});
