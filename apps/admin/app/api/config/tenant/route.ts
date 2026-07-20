import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { createLogger } from "@repo/logger";

const logger = createLogger("config-tenant");

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const tenantId = session.user?.tenantId as string;

    const [tenant] = await db
      .select({
        id: dbTenants.id,
        slug: dbTenants.slug,
        customDomain: dbTenants.customDomain,
      })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return jsonResponse({ error: "Tenant no encontrado" }, 404);
    }

    return jsonResponse(tenant);
  } catch (error) {
    logger.error({ error }, "Error getting tenant");
    return jsonResponse({ error: "Error al obtener tenant" }, 500);
  }
}
