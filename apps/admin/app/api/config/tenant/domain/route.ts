import { NextRequest } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { customDomainSchema } from "@repo/validation";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const tenantId = session.user?.tenantId as string;

    const body = await request.json();
    const validation = customDomainSchema.safeParse(body.customDomain);

    if (!validation.success) {
      return jsonResponse({ error: "Validation failed" }, 400);
    }

    const customDomain = validation.data;

    const [existing] = await db
      .select({ customDomain: dbTenants.customDomain })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1);

    if (!existing) {
      return jsonResponse({ error: "Tenant not found" }, 404);
    }

    if (customDomain && customDomain !== existing.customDomain) {
      const domainExists = await db
        .select({ id: dbTenants.id })
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, customDomain))
        .limit(1);

      if (domainExists.length > 0) {
        return jsonResponse({ error: "Domain already in use" }, 409);
      }
    }

    const [updated] = await db
      .update(dbTenants)
      .set({
        customDomain: customDomain ?? null,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, tenantId))
      .returning({ id: dbTenants.id, slug: dbTenants.slug, customDomain: dbTenants.customDomain });

    return jsonResponse(updated);
  } catch (error) {
    console.error("Error updating domain:", error);
    return jsonResponse({ error: "Failed to update domain" }, 500);
  }
}
