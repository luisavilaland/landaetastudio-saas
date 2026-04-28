import { NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error getting tenant:", error);
    return NextResponse.json(
      { error: "Failed to get tenant" },
      { status: 500 }
    );
  }
}
