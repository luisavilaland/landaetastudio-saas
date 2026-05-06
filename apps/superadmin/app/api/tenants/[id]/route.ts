import { NextRequest, NextResponse } from "next/server";
import { db, dbTenants, dbProducts, dbProductImages, dbProductVariants, dbCategories, dbCustomers, dbOrders, dbOrderItems, dbShippingMethods, dbAdminUsers } from "@repo/db";
import { auth } from "@/lib/auth";
import { redisClient } from "@/lib/redis";
import { eq, inArray } from "drizzle-orm";
import { updateTenantSchema } from "@repo/validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("superadmin-tenant-detail-api");

const TENANT_CACHE_PREFIX = "tenant:slug:";

type Params = Promise<{ id: string }>;

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(error: string, status: number, field?: string) {
  return jsonResponse({ error, ...(field && { field }) }, status);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await auth();

  if (!session) {
    return errorResponse("No autorizado", 401);
  }

  const { id } = await params;

  const tenant = await db
    .select()
    .from(dbTenants)
    .where(eq(dbTenants.id, id))
    .limit(1);

  if (tenant.length === 0) {
    return errorResponse("Tenant no encontrado", 404);
  }

  return jsonResponse(tenant[0]);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

  if (!session) {
    return errorResponse("No autorizado", 401);
  }

  const { id } = await params;
  const body = await request.json();
  const clearDomain = "customDomain" in body && body.customDomain === "";
  const validation = updateTenantSchema.safeParse(body);

  if (!validation.success) {
    return errorResponse("Validación fallida", 400);
  }

  const { name, plan, status, slug, customDomain } = validation.data;

  const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, id))
      .limit(1);

  if (existing.length === 0) {
    return errorResponse("Tenant no encontrado", 404);
  }

  if (slug && slug !== existing[0].slug) {
      const slugExists = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.slug, slug))
        .limit(1);

      if (slugExists.length > 0) {
        return errorResponse("El slug ya existe", 409, "slug");
      }
    }

    if (customDomain && customDomain !== existing[0].customDomain) {
      const domainExists = await db
        .select()
        .from(dbTenants)
        .where(eq(dbTenants.customDomain, customDomain))
        .limit(1);

      if (domainExists.length > 0) {
        return errorResponse("El dominio personalizado ya está en uso", 409, "customDomain");
      }
    }

    const updated = await db
      .update(dbTenants)
      .set({
        name: name ?? existing[0].name,
        plan: plan ?? existing[0].plan,
        status: status ?? existing[0].status,
        slug: slug ?? existing[0].slug,
        customDomain:
          clearDomain
            ? null
            : customDomain !== undefined
              ? customDomain
              : existing[0].customDomain,
        updatedAt: new Date(),
      })
      .where(eq(dbTenants.id, id))
      .returning();

    if (slug) {
      try {
        await redisClient.del(`${TENANT_CACHE_PREFIX}${slug}`);
      } catch (e) {
        logger.error({ error: e }, "[Cache] Failed to invalidate");
      }
    }

    if (clearDomain || customDomain !== undefined) {
      try {
        if (existing[0].customDomain) {
          await redisClient.del(`domain:${existing[0].customDomain}`);
        }
        if (customDomain) {
          await redisClient.setex(`domain:${customDomain}`, 3600, updated[0].slug);
        }
      } catch (e) {
        logger.error({ error: e }, "[Cache] Failed to update domain cache");
      }
    }

    return jsonResponse(updated[0]);
  } catch (error) {
    logger.error({ error }, "Error updating tenant");
    return errorResponse("Error al actualizar tenant", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await auth();

    if (!session) {
      return errorResponse("No autorizado", 401);
    }

    const { id } = await params;

    const existing = await db
      .select()
      .from(dbTenants)
      .where(eq(dbTenants.id, id))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse("Tenant no encontrado", 404);
    }

    const oldSlug = existing[0].slug;

    await db.transaction(async (tx) => {
      // Get all products for this tenant
      const products = await tx
        .select({ id: dbProducts.id })
        .from(dbProducts)
        .where(eq(dbProducts.tenantId, id));

      const productIds = products.map(p => p.id);

      if (productIds.length > 0) {
        // Get all product variants for these products
        const variants = await tx
          .select({ id: dbProductVariants.id })
          .from(dbProductVariants)
          .where(inArray(dbProductVariants.productId, productIds));

        const variantIds = variants.map(v => v.id);

        // Delete order items that reference these variants
        if (variantIds.length > 0) {
          await tx
            .delete(dbOrderItems)
            .where(inArray(dbOrderItems.productVariantId, variantIds));
        }

        // Delete orders for this tenant
        await tx
          .delete(dbOrders)
          .where(eq(dbOrders.tenantId, id));

        // Delete product images
        await tx
          .delete(dbProductImages)
          .where(eq(dbProductImages.tenantId, id));

        // Delete product variants
        await tx
          .delete(dbProductVariants)
          .where(eq(dbProductVariants.tenantId, id));

        // Delete products
        await tx
          .delete(dbProducts)
          .where(eq(dbProducts.tenantId, id));
      }

      // Delete categories
      await tx
        .delete(dbCategories)
        .where(eq(dbCategories.tenantId, id));

      // Delete customers
      await tx
        .delete(dbCustomers)
        .where(eq(dbCustomers.tenantId, id));

      // Delete shipping methods
      await tx
        .delete(dbShippingMethods)
        .where(eq(dbShippingMethods.tenantId, id));

      // Set admin users' tenantId to null
      await tx
        .update(dbAdminUsers)
        .set({ tenantId: null })
        .where(eq(dbAdminUsers.tenantId, id));

      // Finally, delete the tenant
      await tx
        .delete(dbTenants)
        .where(eq(dbTenants.id, id));
    });

    try {
      await redisClient.del(`${TENANT_CACHE_PREFIX}${oldSlug}`);
    } catch (e) {
      logger.error({ error: e }, "[Cache] Failed to invalidate");
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ error }, "Error deleting tenant");
    return errorResponse("Error al eliminar tenant", 500);
  }
}