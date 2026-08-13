import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext, dbCustomers, dbTenants } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getTenantId } from '@/lib/tenant'
import { getStorefrontBaseUrl } from '@/lib/request'
import { registerSchema } from '@repo/validation'
import { sendWelcomeEmail } from '@repo/commerce'
import { createLogger } from '@/lib/logger'

const logger = createLogger('register-api')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = registerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validación fallida', issues: validation.error.issues },
        { status: 400 },
      )
    }

    const { name, email, password } = validation.data

    const tenantId = await getTenantId()
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 400 },
      )
    }

    const { existing, tenant } = await withTenantContext(
      tenantId,
      async (tx) => {
        const [existing] = await tx
          .select({ id: dbCustomers.id })
          .from(dbCustomers)
          .where(
            and(
              eq(dbCustomers.email, email),
              eq(dbCustomers.tenantId, tenantId),
            ),
          )
          .limit(1)

        const [tenant] = await tx
          .select({ name: dbTenants.name })
          .from(dbTenants)
          .where(eq(dbTenants.id, tenantId))
          .limit(1)

        return { existing: existing ?? null, tenant: tenant ?? null }
      },
    )

    if (existing) {
      return NextResponse.json(
        { error: 'Email ya registrado', field: 'email' },
        { status: 409 },
      )
    }

    const storeName = tenant?.name || 'la tienda'
    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date()

    await withTenantContext(tenantId, async (tx) => {
      await tx.insert(dbCustomers).values({
        tenantId,
        name,
        email,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      })
    })

    try {
      await sendWelcomeEmail(
        email,
        name,
        storeName,
        getStorefrontBaseUrl(request),
      )
    } catch (error) {
      logger.error({ email, error }, 'Failed to send welcome email')
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Email ya registrado', field: 'email' },
        { status: 409 },
      )
    }
    logger.error({ error }, 'Register error')
    return NextResponse.json({ error: 'Error al registrar' }, { status: 500 })
  }
}
