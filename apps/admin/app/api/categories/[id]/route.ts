import { NextRequest, NextResponse } from "next/server";
import { db, dbCategories, dbProducts } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const [category] = await db
      .select()
      .from(dbCategories)
      .where(
        and(
          eq(dbCategories.id, id),
          eq(dbCategories.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { error: "Failed to fetch category" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const [existingCategory] = await db
      .select()
      .from(dbCategories)
      .where(
        and(
          eq(dbCategories.id, id),
          eq(dbCategories.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    if (slug !== existingCategory.slug) {
      const existingSlug = await db
        .select()
        .from(dbCategories)
        .where(
          and(
            eq(dbCategories.slug, slug),
            eq(dbCategories.tenantId, tenantId),
            eq(dbCategories.id, id)
          )
        )
        .limit(1);

      if (existingSlug.length > 0) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409 }
        );
      }

      const duplicateSlug = await db
        .select()
        .from(dbCategories)
        .where(
          and(
            eq(dbCategories.slug, slug),
            eq(dbCategories.tenantId, tenantId)
          )
        )
        .limit(1);

      if (duplicateSlug.length > 0 && duplicateSlug[0].id !== id) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409 }
        );
      }
    }

    const now = new Date();

    const [category] = await db
      .update(dbCategories)
      .set({
        name,
        slug,
        updatedAt: now,
      })
      .where(
        and(
          eq(dbCategories.id, id),
          eq(dbCategories.tenantId, tenantId)
        )
      )
      .returning();

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user?.tenantId as string;

    const [existingCategory] = await db
      .select()
      .from(dbCategories)
      .where(
        and(
          eq(dbCategories.id, id),
          eq(dbCategories.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const productsWithCategory = await db
      .select()
      .from(dbProducts)
      .where(
        and(
          eq(dbProducts.categoryId, id),
          eq(dbProducts.tenantId, tenantId)
        )
      )
      .limit(1);

    if (productsWithCategory.length > 0) {
      return NextResponse.json(
        { error: "La categoría tiene productos asociados" },
        { status: 409 }
      );
    }

    await db
      .delete(dbCategories)
      .where(
        and(
          eq(dbCategories.id, id),
          eq(dbCategories.tenantId, tenantId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}