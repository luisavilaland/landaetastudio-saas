import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

const tenantCache = new Map<string, string>();

export async function getTenantId(slug: string): Promise<string | null> {
  if (tenantCache.has(slug)) {
    return tenantCache.get(slug)!;
  }

  const result = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.slug, slug))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const tenantId = result[0].id;
  tenantCache.set(slug, tenantId);
  return tenantId;
}

export async function getTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
  const result = await db
    .select({ id: dbTenants.id, name: dbTenants.name })
    .from(dbTenants)
    .where(eq(dbTenants.slug, slug))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}