import { NextRequest, NextResponse } from 'next/server'
import { db, dbCategories, withTenantContext } from '@repo/db'
import { getTenantId } from '@/lib/tenant'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) {
    return NextResponse.json({ categories: [] })
  }

  return await withTenantContext(tenantId, async (tx) => {
    const categories = await tx
      .select({
        id: dbCategories.id,
        name: dbCategories.name,
        slug: dbCategories.slug,
      })
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId))
      .orderBy(dbCategories.name)

    return NextResponse.json({ categories })
  })
}
