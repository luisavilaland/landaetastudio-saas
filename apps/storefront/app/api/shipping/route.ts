import { NextResponse } from "next/server";
import { db, dbShippingMethods } from "@repo/db";
import { eq, asc } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET() {
  try {
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id");

    if (!tenantId) {
      return NextResponse.json({ methods: [] });
    }

    const methods = await db
      .select()
      .from(dbShippingMethods)
      .where(eq(dbShippingMethods.tenantId, tenantId))
      .orderBy(asc(dbShippingMethods.sortOrder));

    const activeMethods = methods.filter((m) => m.isActive === "true");

    return NextResponse.json({ methods: activeMethods });
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return NextResponse.json({ methods: [] });
  }
}
