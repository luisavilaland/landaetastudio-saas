import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { id } = await params;

  const tenant = await db
    .select()
    .from(dbTenants)
    .where(eq(dbTenants.id, id))
    .limit(1);

  if (tenant.length === 0) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(tenant[0]);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, plan, status, slug } = body;

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    if (slug && slug !== existing[0].slug) {
      const slugExists = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.slug, slug))
        .limit(1);

      if (slugExists.length > 0) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db
      .update(dbTenants)
      .set({
        name: name ?? existing[0].name,
        plan: plan ?? existing[0].plan,
        status: status ?? existing[0].status,
        slug: slug ?? existing[0].slug,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, id))
      .returning();

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { id } = await params;

  const existing = await db
    .select()
    .from(dbTenants)
    .where(eq(dbTenants.id, id))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404 }
    );
  }

  await db.delete(dbTenants).where(eq(dbTenants.id, id));

  return new NextResponse(null, { status: 204 });
}