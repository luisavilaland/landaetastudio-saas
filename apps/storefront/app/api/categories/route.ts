import { NextRequest, NextResponse } from "next/server";
import { db, dbCategories } from "@repo/db";
import { getTenantId } from "@/lib/tenant";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return NextResponse.json({ categories: [] });
  }

  const categories = await db
    .select({
      id: dbCategories.id,
      name: dbCategories.name,
      slug: dbCategories.slug,
    })
    .from(dbCategories)
    .where(eq(dbCategories.tenantId, tenantId))
    .orderBy(dbCategories.name);

  return NextResponse.json({ categories });
}