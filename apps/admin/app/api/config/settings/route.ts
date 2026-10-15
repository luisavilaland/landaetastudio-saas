import { NextRequest, NextResponse } from 'next/server'
import { db, dbTenants } from '@repo/db'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createLogger } from '@repo/logger'

const logger = createLogger('config-settings')

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const storeSettingsSchema = z.object({
  // T11 fix / H-F3-v2-1 (opcion A): `logoUrl` **removido** de este schema.
  //
  // La fuente de verdad del logo es `tenants."logoUrl"`, y se escribe solo por
  // `config/tenant/branding`. Este endpoint dejo de aceptarlo: mientras dos
  // rutas escribieran el logo, existian dos fuentes de verdad y la migracion
  // 0005 habria que volver a correr cada vez que alguien lo cambiara.
  //
  // Consecuencia asumida: el logo queda **congelado** en lo que haya en la
  // base hasta que exista la UI de branding (item 116). Prefiero eso a dos
  // fuentes de verdad que divergen en silencio.
  //
  // OJO: el `PUT` hace `{ ...currentSettings, ...validation.data }`. Como
  // `logoUrl` ya no esta en `validation.data`, el merge lo **conserva** en el
  // jsonb. Eso es deliberado: el campo queda deprecado pero intacto, y lo
  // limpia una migracion aparte cuando ningun proceso lo lea.
  primaryColor: z.string().regex(hexColorRegex).optional(),
  secondaryColor: z.string().regex(hexColorRegex).optional(),
  accentColor: z.string().regex(hexColorRegex).optional(),
  fontFamily: z.string().optional(),
  storeDescription: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  socialLinks: z
    .object({
      instagram: z.string().url().optional(),
      facebook: z.string().url().optional(),
    })
    .optional(),
})

export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const tenantId = session.user?.tenantId as string

    const [tenant] = await db
      .select({ settings: dbTenants.settings, logoUrl: dbTenants.logoUrl })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1)

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 },
      )
    }

    const settings = (tenant.settings as Record<string, unknown>) || {}

    // T11 fix / H-F3-v2-1: el logo se devuelve aparte, desde la columna, y ya
    // NO viaja dentro de `settings`. Es lectura pura: este endpoint dejo de
    // escribir el logo (opcion A), asi que solo lo expone para que la pantalla
    // de ajustes pueda mostrarlo.
    return NextResponse.json({ settings, tenant: { logoUrl: tenant.logoUrl } })
  } catch (error) {
    logger.error({ error }, 'Error getting store settings')
    return NextResponse.json(
      { error: 'Error al obtener configuración de tienda' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const tenantId = session.user?.tenantId as string

    const [existing] = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 },
      )
    }

    const body = await request.json()

    const validation = storeSettingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validación fallida', issues: validation.error.issues },
        { status: 400 },
      )
    }

    const currentSettings = (existing.settings as Record<string, unknown>) || {}
    const newSettings = { ...currentSettings, ...validation.data }

    const [tenant] = await db
      .update(dbTenants)
      .set({
        settings: newSettings,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, tenantId))
      .returning()

    return NextResponse.json({ settings: tenant.settings })
  } catch (error) {
    logger.error({ error }, 'Error updating store settings')
    return NextResponse.json(
      { error: 'Error al actualizar configuración de tienda' },
      { status: 500 },
    )
  }
}
