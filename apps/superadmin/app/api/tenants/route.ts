import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { redisClient } from "@/lib/redis";
import { desc, eq } from "drizzle-orm";
import { createTenantSchema } from "@repo/validation";

const TENANT_CACHE_PREFIX = "tenant:slug:";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenants = await db
    .select()
    .from(dbTenants)
    .orderBy(desc(dbTenants.createdAt));

  return NextResponse.json({ tenants });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
         { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { slug, name, plan, status, customDomain } = validation.data;

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Slug ya existe" },
        { status: 409 }
      );
    }

    if (customDomain) {
      const existingDomain = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, customDomain))
        .limit(1);

      if (existingDomain.length > 0) {
        return NextResponse.json(
          { error: "El dominio personalizado ya está en uso" },
          { status: 409 }
        );
      }
    }

    const newTenant = await db
      .insert(dbTenants)
      .values({
        slug,
        name,
        plan: plan || "starter",
        status: status || "active",
        customDomain: customDomain || null,
      })
      .returning();

    try {
      await redisClient.del(`${TENANT_CACHE_PREFIX}${slug}`);
    } catch (e) {
      console.error("[Cache] Failed to invalidate:", e);
    }

    return NextResponse.json(newTenant[0], { status: 201 });
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Error al crear tenant" },
      { status: 500 }
    );
  }
}