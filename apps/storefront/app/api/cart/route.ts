import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { redisClient } from "@/lib/redis";
import { db, dbProducts, dbProductVariants } from "@repo/db";
import { inArray, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type CartItem = {
  variantId: string;
  quantity: number;
  addedAt: string;
};

type Cart = {
  items: CartItem[];
  updatedAt: string;
};

const CART_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

async function getCart(sessionId: string): Promise<Cart> {
  const data = await redisClient.get(`cart:${sessionId}`);
  if (!data) {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  return JSON.parse(data) as Cart;
}

async function saveCart(sessionId: string, cart: Cart): Promise<void> {
  cart.updatedAt = new Date().toISOString();
  await redisClient.setex(`cart:${sessionId}`, CART_TTL, JSON.stringify(cart));
}

function getEnrichedItems(cart: Cart, variants: any[]) {
  if (cart.items.length === 0) return [];

  const variantMap = new Map(variants.map((v) => [v.variantId, v]));

  const itemsWithProduct = cart.items
    .map((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) return null;

      return {
        ...item,
        product: {
          id: variant.productId,
          name: variant.productName,
          slug: variant.productSlug,
          imageUrl: variant.productImage,
          price: variant.variantPrice,
          stock: variant.variantStock,
        },
      };
    })
    .filter(Boolean);

  return itemsWithProduct;
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const sessionId = headersList.get("x-cart-session-id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sesión de carrito no encontrada" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { variantId, quantity } = body;

    if (!variantId || typeof quantity !== "number" || quantity < 1) {
      return NextResponse.json(
        { error: "variantId y quantity son requeridos" },
        { status: 400 }
      );
    }

    const variant = await db
      .select()
      .from(dbProductVariants)
      .where(eq(dbProductVariants.id, variantId))
      .limit(1);

    if (variant.length === 0) {
      return NextResponse.json(
        { error: "Variante no encontrada" },
        { status: 404 }
      );
    }

    const variantStock = variant[0].stock ?? 0;
    if (variantStock < quantity) {
      return NextResponse.json(
        { error: "Stock insuficiente" },
        { status: 400 }
      );
    }

    const cart = await getCart(sessionId);

    const existingIndex = cart.items.findIndex(
      (item) => item.variantId === variantId
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        variantId,
        quantity,
        addedAt: new Date().toISOString(),
      });
    }

    await saveCart(sessionId, cart);

    return NextResponse.json({ cart, success: true });
  } catch (error) {
    console.error("[Cart API] Error:", error);
    return NextResponse.json(
      { error: "Error al agregar al carrito" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const headersList = await headers();
    const sessionId = headersList.get("x-cart-session-id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sesión de carrito no encontrada" },
        { status: 400 }
      );
    }

    const cart = await getCart(sessionId);

    const body = await request.json();
    const { variantId, quantity } = body;

    if (!variantId || typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json(
        { error: "variantId y quantity son requeridos" },
        { status: 400 }
      );
    }

    if (quantity === 0) {
      cart.items = cart.items.filter((item) => item.variantId !== variantId);
    } else {
      const existingIndex = cart.items.findIndex(
        (item) => item.variantId === variantId
      );

      if (existingIndex >= 0) {
        cart.items[existingIndex].quantity = quantity;
      } else {
        cart.items.push({
          variantId,
          quantity,
          addedAt: new Date().toISOString(),
        });
      }
    }

    await saveCart(sessionId, cart);

    const variantIds = cart.items.map((item) => item.variantId);
    const variants = variantIds.length > 0
      ? await db
          .select({
            variantId: dbProductVariants.id,
            variantPrice: dbProductVariants.price,
            variantStock: dbProductVariants.stock,
            productId: dbProducts.id,
            productName: dbProducts.name,
            productSlug: dbProducts.slug,
            productImage: dbProducts.imageUrl,
          })
          .from(dbProductVariants)
          .innerJoin(dbProducts, eq(dbProductVariants.productId, dbProducts.id))
          .where(inArray(dbProductVariants.id, variantIds))
      : [];

    const items = getEnrichedItems(cart, variants);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[Cart API] PUT Error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el carrito" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const headersList = await headers();
    const sessionId = headersList.get("x-cart-session-id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sesión de carrito no encontrada" },
        { status: 400 }
      );
    }

    const cart = await getCart(sessionId);

    const body = await request.json();
    const { variantId, clearAll } = body;

    if (clearAll) {
      await redisClient.del(`cart:${sessionId}`);
      return NextResponse.json({ items: [] });
    }

    if (!variantId) {
      return NextResponse.json(
        { error: "variantId es requerido" },
        { status: 400 }
      );
    }

    cart.items = cart.items.filter((item) => item.variantId !== variantId);

    await saveCart(sessionId, cart);

    const variantIds = cart.items.map((item) => item.variantId);
    const variants = variantIds.length > 0
      ? await db
          .select({
            variantId: dbProductVariants.id,
            variantPrice: dbProductVariants.price,
            variantStock: dbProductVariants.stock,
            productId: dbProducts.id,
            productName: dbProducts.name,
            productSlug: dbProducts.slug,
            productImage: dbProducts.imageUrl,
          })
          .from(dbProductVariants)
          .innerJoin(dbProducts, eq(dbProductVariants.productId, dbProducts.id))
          .where(inArray(dbProductVariants.id, variantIds))
      : [];

    const items = getEnrichedItems(cart, variants);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[Cart API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Error al eliminar del carrito" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const headersList = await headers();
    const sessionId = headersList.get("x-cart-session-id");

    if (!sessionId) {
      return NextResponse.json({ items: [] });
    }

    const cart = await getCart(sessionId);

    if (cart.items.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const variantIds = cart.items.map((item) => item.variantId);

    const variants = await db
      .select({
        variantId: dbProductVariants.id,
        variantPrice: dbProductVariants.price,
        variantStock: dbProductVariants.stock,
        variantSku: dbProductVariants.sku,
        productId: dbProducts.id,
        productName: dbProducts.name,
        productSlug: dbProducts.slug,
        productImage: dbProducts.imageUrl,
      })
      .from(dbProductVariants)
      .innerJoin(dbProducts, eq(dbProductVariants.productId, dbProducts.id))
      .where(
        variantIds.length > 0
          ? inArray(dbProductVariants.id, variantIds)
          : undefined
      );

    const variantMap = new Map(variants.map((v) => [v.variantId, v]));

    const itemsWithProduct = cart.items
      .map((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant) return null;

        return {
          ...item,
          product: {
            id: variant.productId,
            name: variant.productName,
            slug: variant.productSlug,
            imageUrl: variant.productImage,
            price: variant.variantPrice,
            stock: variant.variantStock,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: itemsWithProduct });
  } catch (error) {
    console.error("[Cart API] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener el carrito" },
      { status: 500 }
    );
  }
}