import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import {
  db,
  dbPlans,
  dbTenants,
  dbSubscriptions,
  dbAdminUsers,
  withTenantContext,
} from '@repo/db'
import { registerTenantSchema } from '@repo/validation'
import { validateSlug, slugRejectionMessage } from '@repo/commerce'
import { createLogger } from '@/lib/logger'

const logger = createLogger('register-tenant-api')

export const dynamic = 'force-dynamic'

/**
 * Nombres reales de las constraints, leidos de `0000_baseline.sql`.
 *
 * `23505` es el mismo codigo para toda violacion de unique, asi que el catch
 * tiene que mirar **que** constraint se violo. Sin esto, el mensaje del error
 * le miente al usuario: un slug tomado se reportaria como "Email ya registrado",
 * que es exactamente lo que hacia el `register` de comprador y por que ahi
 * funciona - esa ruta solo tiene una unique en juego, esta tiene tres.
 */
const SLUG_CONSTRAINT = 'tenants_slug_unique'
const EMAIL_CONSTRAINT = 'admin_users_email_unique'

/** Postgres 23505: violation de restriccion unique. */
function constraintOf(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const e = error as { code?: unknown; constraint?: unknown }
  if (e.code !== '23505') return null
  return typeof e.constraint === 'string' ? e.constraint : null
}

/**
 * S3 / T7 - Alta publica de tenant.
 *
 * A diferencia de `/api/register` (que registra un COMPRADOR dentro de una tienda
 * existente y resuelve el tenant del host), este crea el tenant. No hay host que
 * lo resuelva todavia: por eso es publico y por eso `tenantId` se pre-genera en
 * la app (D3).
 *
 * **Que NO hace:** no crea `tenant_mp_config` (D9, va a S3b), no activa el tenant
 * (lo hace el webhook al confirmar el pago) y no devuelve token de sesion. El
 * `authorize()` de `@repo/auth` ya valida contra `admin_users`, asi que el owner
 * se autentica con las credenciales que acaba de crear.
 */
export async function POST(request: NextRequest) {
  let tenantId: string | null = null

  try {
    const body = await request.json()
    const validation = registerTenantSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validación fallida', issues: validation.error.issues },
        { status: 400 },
      )
    }

    const { name, email, password, slug, planId } = validation.data

    // D8: los 16 reservados, antes de tocar la base. Este chequeo NO reemplaza al
    // UNIQUE: dos registros simultaneos con el mismo slug producen una
    // violacion de `tenants_slug_unique`, y la captura del catch es la que
    // resuelve esa carrera. Pre-check sin catch seria la misma clase de error
    // que el item 61: un control que acompana y no verifica.
    const slugRejection = validateSlug(slug)
    if (slugRejection) {
      return NextResponse.json(
        { error: slugRejectionMessage(slugRejection), field: 'slug' },
        { status: slugRejection === 'reserved' ? 409 : 400 },
      )
    }

    // `plans` es catalogo global y no tiene RLS, asi que va directo con `db`.
    // Ademas es una lectura que no es parte del alta: meterla dentro de la
    // transaccion la dejaria abierta sin motivo.
    const [plan] = await db
      .select({ id: dbPlans.id })
      .from(dbPlans)
      .where(eq(dbPlans.id, planId))
      .limit(1)

    if (!plan) {
      return NextResponse.json(
        { error: 'El plan seleccionado no existe' },
        { status: 404 },
      )
    }

    // D3: en la app, antes de la transaccion. Las dos filas siguientes tienen FK
    // a `tenants.id` y necesitan `set_tenant_id(tenantId)` para escribirse.
    //
    // `newTenantId` es const y `tenantId` (declarado arriba, para el log del
    // catch) es mutable. Por eso las inserciones usan la const: con la mutable,
    // TypeScript no estrecha dentro del closure y habria que castear.
    const newTenantId = crypto.randomUUID()
    tenantId = newTenantId

    // El hash va FUERA de la transaccion a proposito. `bcrypt.hash` con 10
    // rounds son ~100 ms de CPU: dentro, la transaccion de la DB quedaria
    // abierta ese tiempo sin hacer nada, y en Neon una transaccion abierta es
    // una conexion abierta. Afuera, dura lo que dura el INSERT.
    const passwordHash = await bcrypt.hash(password, 10)

    // `return await` es obligatorio (AGENTS.md): sin `await`, una rejection de
    // `db.transaction` bypasea el `try/catch` de abajo.
    return await withTenantContext(newTenantId, async (tx) => {
      // Orden por FK, no por importancia: las dos filas siguientes referencian
      // `tenants.id`.
      await tx.insert(dbTenants).values({
        id: newTenantId,
        slug,
        name,
        status: 'pending',
      })

      // `role: 'admin'` es el rol de tenant admin en este schema. El rol de
      // plataforma es 'superadmin'. 'admin' + tenantId resuelve apps/admin;
      // 'superadmin' + tenantId NULL resuelve apps/superadmin.
      //
      // Verificado contra produccion: las 2 filas con role='admin' tienen
      // tenantId. Un 'owner' seria un segundo nombre para lo mismo, y
      // `authorize()` (que exige `role === 'admin'`) devolveria null: la cuenta
      // no podria autenticarse nunca.
      await tx.insert(dbAdminUsers).values({
        email,
        password: passwordHash,
        role: 'admin',
        tenantId: newTenantId,
      })

      await tx.insert(dbSubscriptions).values({
        tenantId: newTenantId,
        planId,
        status: 'pending_first_payment',
      })

      return NextResponse.json({ tenantId: newTenantId, slug }, { status: 201 })
    })
  } catch (error) {
    const constraint = constraintOf(error)

    if (constraint === SLUG_CONSTRAINT) {
      return NextResponse.json(
        { error: 'Slug ya existe', field: 'slug' },
        { status: 409 },
      )
    }

    if (constraint === EMAIL_CONSTRAINT) {
      return NextResponse.json(
        { error: 'Email ya registrado', field: 'email' },
        { status: 409 },
      )
    }

    // 23505 sin constraint utilizable: se reporta por el slug, que es la
    // restriccion que este endpoint controla de verdad.
    if (constraint !== null) {
      return NextResponse.json(
        { error: 'Slug ya existe', field: 'slug' },
        { status: 409 },
      )
    }

    logger.error({ error, tenantId }, 'Register tenant error')
    return NextResponse.json({ error: 'Error al registrar' }, { status: 500 })
  }
}
