import { NextRequest, NextResponse } from "next/server";
import { db, dbCustomers, dbTenants } from "@repo/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getTenantId } from "@/lib/tenant";
import { registerSchema } from "@repo/validation";
import { sendWelcomeEmail } from "@repo/commerce";
import { createLogger } from "@/lib/logger";

const logger = createLogger("register-api");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validación fallida", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    // Get tenant from header
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 400 }
      );
    }

    // Check if customer already exists for this tenant
    const [existing] = await db
      .select({ id: dbCustomers.id })
      .from(dbCustomers)
      .where(
        and(
          eq(dbCustomers.email, email),
          eq(dbCustomers.tenantId, tenantId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Email ya registrado", field: "email" },
        { status: 409 }
      );
    }

    // Get tenant name for welcome email
    const [tenant] = await db
      .select({ name: dbTenants.name })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1);

    const storeName = tenant?.name || "la tienda";

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

    // Send welcome email (non-blocking)
    try {
      await sendWelcomeEmail(email, name, storeName, process.env.STOREFRONT_URL);
    } catch (error) {
      logger.error({ email, error }, "Failed to send welcome email");
    }

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