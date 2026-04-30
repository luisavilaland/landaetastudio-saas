import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";


function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return jsonResponse({ error: "Unauthorized" }, 401);
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
      return jsonResponse({ error: "Tenant not found" }, 404);
    }

    return jsonResponse(tenant);
  } catch (error) {
    console.error("Error getting tenant:", error);
    return jsonResponse({ error: "Failed to get tenant" }, 500);
  }
}
