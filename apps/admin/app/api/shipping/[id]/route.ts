import { NextRequest, NextResponse } from "next/server";
import { db, dbShippingMethods, withTenantContext } from "@repo/db";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { updateShippingMethodSchema } from "@repo/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    return await withTenantContext(tenantId, async (tx) => {
      const [method] = await tx
        .select()
        .from(dbShippingMethods)
        .where(
          and(
            eq(dbShippingMethods.id, id),
            eq(dbShippingMethods.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!method) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }

      return NextResponse.json({ method });
    });
  } catch (error) {
    console.error("Error getting shipping method:", error);
    return NextResponse.json(
      { error: "Error al obtener método de envío" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    return await withTenantContext(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(dbShippingMethods)
        .where(
          and(
            eq(dbShippingMethods.id, id),
            eq(dbShippingMethods.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }

      const body = await request.json();

      const validation = updateShippingMethodSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: "Validación fallida", issues: validation.error.issues },
          { status: 400 }
        );
      }

      const updates: Record<string, unknown> = {
        ...validation.data,
        updatedAt: new Date(),
      };

      if (updates.isActive !== undefined) {
        updates.isActive = updates.isActive ? "true" : "false";
      }

      const [method] = await tx
        .update(dbShippingMethods)
        .set(updates)
        .where(
          and(
            eq(dbShippingMethods.id, id),
            eq(dbShippingMethods.tenantId, tenantId)
          )
        )
        .returning();

      return NextResponse.json({ method });
    });
  } catch (error) {
    console.error("Error updating shipping method:", error);
    return NextResponse.json(
      { error: "Error al actualizar método de envío" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = session.user?.tenantId as string;
    const { id } = await params;

    return await withTenantContext(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(dbShippingMethods)
        .where(
          and(
            eq(dbShippingMethods.id, id),
            eq(dbShippingMethods.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }

      await tx
        .delete(dbShippingMethods)
        .where(
          and(
            eq(dbShippingMethods.id, id),
            eq(dbShippingMethods.tenantId, tenantId)
          )
        );

      return new NextResponse(null, { status: 204 });
    });
  } catch (error) {
    console.error("Error deleting shipping method:", error);
    return NextResponse.json(
      { error: "Error al eliminar método de envío" },
      { status: 500 }
    );
  }
}