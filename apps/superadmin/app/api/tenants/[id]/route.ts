import { NextRequest } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { redisClient } from "@/lib/redis";
import { eq } from "drizzle-orm";
import { updateTenantSchema } from "@repo/validation";

const TENANT_CACHE_PREFIX = "tenant:slug:";
const JSON_HEADERS = { "Content-Type": "application/json" };

type Params = Promise<{ id: string }>;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();

  if (!session) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const tenant = await db
    .select()
    .from(dbTenants)
    .where(eq(dbTenants.id, id))
    .limit(1);

  if (tenant.length === 0) {
    return errorResponse("Tenant not found", 404);
  }

  return jsonResponse(tenant[0]);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return errorResponse("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateTenantSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse("Validation failed", 400);
    }

    const { name, plan, status, slug, customDomain } = validation.data;

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, id))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse("Tenant not found", 404);
    }

    if (slug && slug !== existing[0].slug) {
      const slugExists = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.slug, slug))
        .limit(1);

      if (slugExists.length > 0) {
        return errorResponse("Slug already exists", 409);
      }
    }

    if (customDomain && customDomain !== existing[0].customDomain) {
      const domainExists = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, customDomain))
        .limit(1);

      if (domainExists.length > 0) {
        return errorResponse("Custom domain already in use", 409);
      }
    }

    const updated = await db
      .update(dbTenants)
      .set({
        name: name ?? existing[0].name,
        plan: plan ?? existing[0].plan,
        status: status ?? existing[0].status,
        slug: slug ?? existing[0].slug,
        customDomain:
          customDomain !== undefined
            ? customDomain === ""
              ? null
              : customDomain
            : existing[0].customDomain,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, id))
      .returning();

    if (slug) {
      try {
        await redisClient.del(`${TENANT_CACHE_PREFIX}${slug}`);
      } catch (e) {
        console.error("[Cache] Failed to invalidate:", e);
      }
    }

    if (customDomain !== undefined) {
      try {
        if (existing[0].customDomain) {
          await redisClient.del(`domain:${existing[0].customDomain}`);
        }
        if (customDomain) {
          await redisClient.setex(`domain:${customDomain}`, 3600, updated[0].slug);
        }
      } catch (e) {
        console.error("[Cache] Failed to update domain cache:", e);
      }
    }

    return jsonResponse(updated[0]);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return errorResponse("Failed to update tenant", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return errorResponse("Unauthorized", 401);
    }

    const { id } = await params;

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, id))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse("Tenant not found", 404);
    }

    const oldSlug = existing[0].slug;
    await db.delete(dbTenants).where(eq(dbTenants.id, id));

    try {
      await redisClient.del(`${TENANT_CACHE_PREFIX}${oldSlug}`);
    } catch (e) {
      console.error("[Cache] Failed to invalidate:", e);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return errorResponse("Failed to delete tenant", 500);
  }
}