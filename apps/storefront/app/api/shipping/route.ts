import { NextResponse } from 'next/server'
import { db, dbShippingMethods, withTenantContext } from '@repo/db'
import { eq, asc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createLogger } from '@repo/logger'

const logger = createLogger('storefront-shipping')

export async function GET() {
  try {
    const headersList = await headers()
    const tenantId = headersList.get('x-tenant-id')

    if (!tenantId) {
      return NextResponse.json({ methods: [] })
    }

    return await withTenantContext(tenantId, async (tx) => {
      const methods = await tx
        .select()
        .from(dbShippingMethods)
        .where(eq(dbShippingMethods.tenantId, tenantId))
        .orderBy(asc(dbShippingMethods.sortOrder))

      const activeMethods = methods.filter((m) => m.isActive === 'true')

      return NextResponse.json({ methods: activeMethods })
    })
  } catch (error) {
    logger.error({ error }, 'Error fetching shipping methods')
    return NextResponse.json({ methods: [] })
  }
}
