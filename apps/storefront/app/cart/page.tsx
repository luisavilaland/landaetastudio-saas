import { headers } from "next/headers";
import { getCart } from "@/lib/cart";
import { CartList } from "@/components/cart-list";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const headersList = await headers();
  const sessionId = headersList.get("x-cart-session-id");

  const items = sessionId ? await getCart(sessionId) : [];

  return <CartList initialItems={items} />;
}