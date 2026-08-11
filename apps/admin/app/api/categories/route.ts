import { NextRequest, NextResponse } from 'next/server'
import { db, dbCategories, withTenantContext } from '@repo/db'
import { auth } from '@/lib/auth'
import { and, eq, asc } from 'drizzle-orm'
import { createCategorySchema, normalizeSlug } from '@repo/validation'
import { createLogger } from '@/lib/logger'

const logger = createLogger('admin-categories-api')

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tenantId = session.user?.tenantId as string

  return await withTenantContext(tenantId, async (tx) => {
    const categories = await tx
      .select()
      .from(dbCategories)
      .where(eq(dbCategories.tenantId, tenantId))
      .orderBy(asc(dbCategories.name))

    return NextResponse.json({ categories })
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const tenantId = session.user?.tenantId as string

    const body = await request.json()
    const validation = createCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validación fallida', issues: validation.error.issues },
        { status: 400 },
      )
    }

    const { name, slug } = validation.data
    const normalizedSlug = normalizeSlug(slug)

    return await withTenantContext(tenantId, async (tx) => {
      const existingSlug = await tx
        .select()
        .from(dbCategories)
        .where(
          and(
            eq(dbCategories.slug, normalizedSlug),
            eq(dbCategories.tenantId, tenantId),
          ),
        )
        .limit(1)

      if (existingSlug.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe una categoría con ese slug', field: 'slug' },
          { status: 409 },
        )
      }

      const now = new Date()

      const [category] = await tx
        .insert(dbCategories)
        .values({
          tenantId,
          name,
          slug: normalizedSlug,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      return NextResponse.json({ category }, { status: 201 })
    })
  } catch (error) {
    logger.error({ error }, 'Error creating category')
    return NextResponse.json(
      { error: 'Error al crear categoría' },
      { status: 500 },
    )
  }
}
