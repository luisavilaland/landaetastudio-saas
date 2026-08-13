import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, dbOrders, dbCustomers, withTenantContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-orders-api')

const VALID_STATUSES = [
  'pending_payment',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 400 },
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    return await withTenantContext(tenantId, async (tx) => {
      const whereConditions = [eq(dbOrders.tenantId, tenantId)]
      if (status && VALID_STATUSES.includes(status)) {
        whereConditions.push(eq(dbOrders.status, status))
      }

      const orders = await tx
        .select({
          id: dbOrders.id,
          customerId: dbOrders.customerId,
          customerEmail: dbOrders.customerEmail,
          total: dbOrders.total,
          status: dbOrders.status,
          createdAt: dbOrders.createdAt,
          updatedAt: dbOrders.updatedAt,
        })
        .from(dbOrders)
        .leftJoin(dbCustomers, eq(dbOrders.customerId, dbCustomers.id))
        .where(and(...whereConditions))
        .orderBy(dbOrders.createdAt)

      const ordersWithCustomer = orders.map((order) => ({
        id: order.id,
        customerName: order.customerId ? null : null,
        customerEmail: order.customerEmail,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }))

      return NextResponse.json(ordersWithCustomer)
    })
  } catch (error) {
    logger.error({ error }, '[Orders GET] Error')
    return NextResponse.json(
      { error: 'Error al obtener órdenes' },
      { status: 500 },
    )
  }
}
