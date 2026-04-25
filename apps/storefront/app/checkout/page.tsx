"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type CartItem = {
  variantId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
    stock: number | null;
  };
};

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    async function fetchCart() {
      try {
        const res = await fetch("/api/cart", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (e) {
        console.error("Error fetching cart:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCart();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        throw new Error(err.error || "Error al crear orden");
      }

      const { orderId } = await checkoutRes.json();

      const prefRes = await fetch("/api/checkout/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!prefRes.ok) {
        const err = await prefRes.json();
        throw new Error(err.error || "Error al crear preferencia de pago");
      }

      const { init_point } = await prefRes.json();

      window.location.href = init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setProcessing(false);
    }
  };

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">Tu carrito está vacío</p>
        <a href="/cart" className="text-blue-600 hover:underline">
          Volver al carrito
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8">Finalizar compra</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">Datos de envío</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="juan@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="099123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Av. Italia 1234"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {processing ? "Procesando..." : `Pagar $${(total / 100).toFixed(2)}`}
              </button>
            </form>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Resumen del pedido</h2>
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              {items.map((item) => (
                <div key={item.variantId} className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${((item.product.price * item.quantity) / 100).toFixed(2)}</p>
                </div>
              ))}
              <div className="border-t pt-4 flex justify-between font-bold">
                <span>Total</span>
                <span>${(total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}