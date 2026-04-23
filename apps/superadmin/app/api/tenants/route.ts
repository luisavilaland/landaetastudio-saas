import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const tenants = await db
    .select()
    .from(dbTenants)
    .orderBy(desc(dbTenants.createdAt));

  return NextResponse.json({ tenants });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, plan, status } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { error: "slug and name are required" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 }
      );
    }

    const newTenant = await db
      .insert(dbTenants)
      .values({
        slug,
        name,
        plan: plan || "starter",
        status: status || "active",
      })
      .returning();

    return NextResponse.json(newTenant[0], { status: 201 });
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    );
  }
}