import { NextRequest, NextResponse } from 'next/server'
import { db, dbCategories, dbProducts, withTenantContext } from '@repo/db'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'
import { updateCategorySchema } from '@repo/validation'
import { createLogger } from '@repo/logger'

const logger = createLogger('categories-id')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const tenantId = session.user?.tenantId as string

    return await withTenantContext(tenantId, async (tx) => {
      const [category] = await tx
        .select()
        .from(dbCategories)
        .where(
          and(eq(dbCategories.id, id), eq(dbCategories.tenantId, tenantId)),
        )
        .limit(1)

      if (!category) {
        return NextResponse.json(
          { error: 'Categoría no encontrada' },
          { status: 404 },
        )
      }

      return NextResponse.json({ category })
    })
  } catch (error) {
    logger.error({ error }, 'Error fetching category')
    return NextResponse.json(
      { error: 'Error al obtener categoría' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const tenantId = session.user?.tenantId as string

    return await withTenantContext(tenantId, async (tx) => {
      const [existingCategory] = await tx
        .select()
        .from(dbCategories)
        .where(
          and(eq(dbCategories.id, id), eq(dbCategories.tenantId, tenantId)),
        )
        .limit(1)

      if (!existingCategory) {
        return NextResponse.json(
          { error: 'Categoría no encontrada' },
          { status: 404 },
        )
      }

      const body = await request.json()
      const validation = updateCategorySchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validación fallida', issues: validation.error.issues },
          { status: 400 },
        )
      }

      const { name, slug: providedSlug } = validation.data

      if (!name && !providedSlug) {
        return NextResponse.json(
          { error: 'Debe proporcionar al menos un campo' },
          { status: 400 },
        )
      }

      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      }

      const slug =
        name && name !== existingCategory.name
          ? generateSlug(name)
          : providedSlug || existingCategory.slug

      if (slug !== existingCategory.slug) {
        const duplicateSlug = await tx
          .select()
          .from(dbCategories)
          .where(
            and(
              eq(dbCategories.slug, slug),
              eq(dbCategories.tenantId, tenantId),
            ),
          )
          .limit(1)

        if (duplicateSlug.length > 0 && duplicateSlug[0].id !== id) {
          return NextResponse.json(
            { error: 'Ya existe una categoría con ese slug', field: 'slug' },
            { status: 409 },
          )
        }
      }

      const now = new Date()
      const updateData: Record<string, unknown> = { updatedAt: now }
      if (name) updateData.name = name
      updateData.slug = slug

      const [category] = await tx
        .update(dbCategories)
        .set(updateData)
        .where(
          and(eq(dbCategories.id, id), eq(dbCategories.tenantId, tenantId)),
        )
        .returning()

      return NextResponse.json({ category })
    })
  } catch (error) {
    logger.error({ error }, 'Error updating category')
    return NextResponse.json(
      { error: 'Error al actualizar categoría' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const tenantId = session.user?.tenantId as string

    return await withTenantContext(tenantId, async (tx) => {
      const [existingCategory] = await tx
        .select()
        .from(dbCategories)
        .where(
          and(eq(dbCategories.id, id), eq(dbCategories.tenantId, tenantId)),
        )
        .limit(1)

      if (!existingCategory) {
        return NextResponse.json(
          { error: 'Categoría no encontrada' },
          { status: 404 },
        )
      }

      const productsWithCategory = await tx
        .select()
        .from(dbProducts)
        .where(
          and(eq(dbProducts.categoryId, id), eq(dbProducts.tenantId, tenantId)),
        )
        .limit(1)

      if (productsWithCategory.length > 0) {
        return NextResponse.json(
          { error: 'La categoría tiene productos asociados' },
          { status: 409 },
        )
      }

      await tx
        .delete(dbCategories)
        .where(
          and(eq(dbCategories.id, id), eq(dbCategories.tenantId, tenantId)),
        )

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    logger.error({ error }, 'Error deleting category')
    return NextResponse.json(
      { error: 'Error al eliminar categoría' },
      { status: 500 },
    )
  }
}
