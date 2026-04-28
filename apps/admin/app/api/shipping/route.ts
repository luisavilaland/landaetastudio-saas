import { NextRequest, NextResponse } from "next/server";
import { db, dbShippingMethods } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";
import { createShippingMethodSchema } from "@repo/validation";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user?.tenantId as string;

  const methods = await db
    .select()
    .from(dbShippingMethods)
    .where(eq(dbShippingMethods.tenantId, tenantId))
    .orderBy(asc(dbShippingMethods.sortOrder));

  return NextResponse.json({ methods });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;

    const body = await request.json();

    const validation = createShippingMethodSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, price, freeShippingThreshold, estimatedDaysMin, estimatedDaysMax, isActive, sortOrder } = validation.data;

    const now = new Date();

    const [method] = await db
      .insert(dbShippingMethods)
      .values({
        tenantId,
        name,
        description: description || null,
        price,
        freeShippingThreshold: freeShippingThreshold || null,
        estimatedDaysMin: estimatedDaysMin || null,
        estimatedDaysMax: estimatedDaysMax || null,
        isActive: isActive ? "true" : "false",
        sortOrder: sortOrder || 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ method }, { status: 201 });
  } catch (error) {
    console.error("Error creating shipping method:", error);
    return NextResponse.json(
      { error: "Failed to create shipping method" },
      { status: 500 }
    );
  }
}