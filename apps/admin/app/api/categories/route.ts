import { NextRequest, NextResponse } from "next/server";
import { db, dbCategories } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq, asc } from "drizzle-orm";
import { createCategorySchema } from "@repo/validation";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user?.tenantId as string;

  const categories = await db
    .select()
    .from(dbCategories)
    .where(eq(dbCategories.tenantId, tenantId))
    .orderBy(asc(dbCategories.name));

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, slug } = validation.data;

    const existingSlug = await db
      .select()
      .from(dbCategories)
      .where(
        and(
          eq(dbCategories.slug, slug),
          eq(dbCategories.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existingSlug.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    const now = new Date();

    const [category] = await db
      .insert(dbCategories)
      .values({
        tenantId,
        name,
        slug,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}