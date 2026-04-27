import { NextRequest, NextResponse } from "next/server";
import { db, dbCustomers, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getTenantId } from "@/lib/tenant";
import { registerSchema } from "@repo/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    // Get tenant from header
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (!tenantSlug) {
      return NextResponse.json(
        { error: "Tenant no especificado" },
        { status: 400 }
      );
    }

    const tenantId = await getTenantId(tenantSlug);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 400 }
      );
    }

    // Check if customer already exists for this tenant
    const [existing] = await db
      .select({ id: dbCustomers.id, tenantId: dbCustomers.tenantId })
      .from(dbCustomers)
      .where(eq(dbCustomers.email, email))
      .limit(1);

    if (existing && existing.tenantId === tenantId) {
      return NextResponse.json(
        { error: "Email ya registrado" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create customer
    const now = new Date();
    await db.insert(dbCustomers).values({
      tenantId,
      name,
      email,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { error: "Error al registrar" },
      { status: 500 }
    );
  }
}