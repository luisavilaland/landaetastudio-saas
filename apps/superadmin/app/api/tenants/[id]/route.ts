import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { redisClient } from "@/lib/redis";
import { eq } from "drizzle-orm";

const TENANT_CACHE_PREFIX = "tenant:slug:";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    if (slug) {
      try {
        await redisClient.del(`${TENANT_CACHE_PREFIX}${slug}`);
      } catch (e) {
        console.error("[Cache] Failed to invalidate:", e);
      }
    }

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
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const oldSlug = existing[0].slug;
    await db.delete(dbTenants).where(eq(dbTenants.id, id));

    try {
      await redisClient.del(`${TENANT_CACHE_PREFIX}${oldSlug}`);
    } catch (e) {
      console.error("[Cache] Failed to invalidate:", e);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json(
      { error: "Failed to delete tenant" },
      { status: 500 }
    );
  }
}