import { NextRequest, NextResponse } from 'next/server'
import { db, dbTenants, withTenantContext } from '@repo/db'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { uploadImage } from '@repo/storage'
import { randomUUID } from 'node:crypto'
import { createLogger } from '@repo/logger'

const logger = createLogger('tenant-branding')

/**
 * T11 / D16: branding basico del tenant.
 *
 * **Por que un endpoint aparte y no un `PATCH` de `/api/config/tenant`.** Ese
 * expone `slug` y `customDomain`. `slug` tiene reglas propias (D8: reservado,
 * nunca se reutiliza, nunca se cambia en caliente porque hay enlaces viejos
 * apuntando) y `customDomain` necesita verificacion de DNS. Meterlos en la
 * misma superficie de escritura seria abrir la puerta a cambiar el slug con un
 * request de logo.
 *
 * `customDomain` ya esta en el schema pero **no entra aca**: resolverse ya esta
 * en el proxy, pero emitir y verificar un dominio con DNS es otro flujo (Fase 4).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const tenantId = session.user?.tenantId as string | undefined
    if (!tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get('logo')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Se esperaba un archivo en el campo "logo"' },
        { status: 400 },
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío' },
        { status: 400 },
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'El archivo debe ser una imagen', field: 'logo' },
        { status: 400 },
      )
    }

    // Progresividad (R5 del design): si R2 no esta configurado, el tenant se
    // queda **sin logo** y la API responde 200 igual. Un 500 por falta de un
    // servicio externo es exactamente lo que R5 prohibe: el logo es decorativo,
    // la tienda tiene que seguir funcionando sin el.
    let logoUrl: string | null = null
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      logoUrl = await uploadImage(
        buffer,
        `branding/${tenantId}/${randomUUID()}-${file.name}`,
        file.type,
      )
    } catch (error) {
      logger.warn(
        { tenantId, error },
        'Logo upload failed - continuing without branding',
      )
    }

    // `withTenantContext` y no `db.update` directo: `tenants` no tiene RLS, asi
    // que un update sin filtro seria cross-tenant por definicion (lo dice el
    // docblock de `activateTenant`). El contexto no protege -no hay policy que
    // lo haga- pero mantiene la forma unica de escribir en la tabla.
    return await withTenantContext(tenantId, async (tx) => {
      const [updated] = await tx
        .update(dbTenants)
        .set({ logoUrl, updatedAt: new Date() })
        .where(eq(dbTenants.id, tenantId))
        .returning({
          id: dbTenants.id,
          slug: dbTenants.slug,
          name: dbTenants.name,
          logoUrl: dbTenants.logoUrl,
        })

      if (!updated) {
        return NextResponse.json(
          { error: 'Tenant no encontrado' },
          { status: 404 },
        )
      }

      return NextResponse.json(updated, { status: 200 })
    })
  } catch (error) {
    logger.error({ error }, 'Error updating tenant branding')
    return NextResponse.json(
      { error: 'Error al actualizar el branding' },
      { status: 500 },
    )
  }
}
