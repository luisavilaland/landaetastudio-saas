import { headers } from "next/headers";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

export async function getTenantId(): Promise<string | null> {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug");
  
  if (!tenantSlug || tenantSlug.trim() === "") {
    return null;
  }
  
  const result = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.slug, tenantSlug))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return result[0].id;
}
