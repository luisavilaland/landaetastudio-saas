import { NextRequest, NextResponse } from "next/server";
import { db, dbCategories } from "@repo/db";
import { auth } from "@/lib/auth";
import { and, eq, asc } from "drizzle-orm";

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

    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

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