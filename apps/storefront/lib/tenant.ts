import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { redisClient } from "./redis";

const TENANT_CACHE_PREFIX = "tenant:slug:";
const TENANT_CACHE_TTL = 300;

async function getTenantIdFromCache(slug: string): Promise<string | null> {
  try {
    const cached = await redisClient.get(`${TENANT_CACHE_PREFIX}${slug}`);
    return cached || null;
  } catch (error) {
    console.error("[Tenant Cache] Redis get error:", error);
    return null;
  }
}

async function setTenantIdToCache(slug: string, tenantId: string, ttl: number = TENANT_CACHE_TTL): Promise<void> {
  try {
    await redisClient.setex(`${TENANT_CACHE_PREFIX}${slug}`, ttl, tenantId);
  } catch (error) {
    console.error("[Tenant Cache] Redis set error:", error);
  }
}

export async function invalidateTenantCache(slug: string): Promise<void> {
  try {
    await redisClient.del(`${TENANT_CACHE_PREFIX}${slug}`);
  } catch (error) {
    console.error("[Tenant Cache] Redis delete error:", error);
  }
}

export async function getTenantId(slug: string): Promise<string | null> {
  const cached = await getTenantIdFromCache(slug);
  if (cached) {
    return cached;
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
  await setTenantIdToCache(slug, tenantId);
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