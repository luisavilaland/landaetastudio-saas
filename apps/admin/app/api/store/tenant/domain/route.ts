import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { customDomainSchema } from "@repo/validation";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;

    const body = await request.json();
    const validation = customDomainSchema.safeParse(body.customDomain);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const customDomain = validation.data;

    const [existing] = await db
      .select({ customDomain: dbTenants.customDomain })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (customDomain && customDomain !== existing.customDomain) {
      const domainExists = await db
        .select({ id: dbTenants.id })
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, customDomain))
        .limit(1);

      if (domainExists.length > 0) {
        return NextResponse.json(
          { error: "Domain already in use" },
          { status: 409 }
        );
      }
    }

    const [updated] = await db
      .update(dbTenants)
      .set({
        customDomain: customDomain ?? null,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, tenantId))
      .returning({ id: dbTenants.id, slug: dbTenants.slug, customDomain: dbTenants.customDomain });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating domain:", error);
    return NextResponse.json(
      { error: "Failed to update domain" },
      { status: 500 }
    );
  }
}
