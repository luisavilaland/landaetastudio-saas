'use client'

import { useState, useEffect } from 'react'
import { captureException } from '@sentry/nextjs'

type CartItem = {
  variantId: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    imageUrl: string | null
    price: number
    stock: number | null
  }
}

type ShippingMethod = {
  id: string
  name: string
  description: string | null
  price: number
  freeShippingThreshold: number | null
  estimatedDaysMin: number | null
  estimatedDaysMax: number | null
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [selectedShippingId, setSelectedShippingId] = useState<string>('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const [cartRes, shippingRes] = await Promise.all([
          fetch('/api/cart', { credentials: 'include' }),
          fetch('/api/shipping'),
        ])

        if (cartRes.ok) {
          const data = await cartRes.json()
          setItems(data.items || [])
        }

        if (shippingRes.ok) {
          const data = await shippingRes.json()
          const methods = data.methods || []
          setShippingMethods(methods)
          if (methods.length > 0) {
            setSelectedShippingId(methods[0].id)
          }
        }
      } catch (e) {
        captureException(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const selectedMethod = shippingMethods.find(
    (m) => m.id === selectedShippingId,
  )

  const cartTotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  )

  const shippingCost = selectedMethod
    ? selectedMethod.freeShippingThreshold &&
      cartTotal >= selectedMethod.freeShippingThreshold
      ? 0
      : selectedMethod.price
    : 0

  const total = cartTotal + shippingCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setProcessing(true)

    try {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          shippingMethodId: selectedShippingId || undefined,
        }),
      })

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json()
        throw new Error(err.error || 'Error al crear orden')
      }

      const { orderId } = await checkoutRes.json()

      const prefRes = await fetch('/api/checkout/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, customerEmail: form.email }),
      })

      if (!prefRes.ok) {
        const err = await prefRes.json()
        throw new Error(err.error || 'Error al crear preferencia de pago')
      }

      const { init_point } = await prefRes.json()
      window.location.href = init_point
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="mb-4 text-gray-500">Tu carrito está vacío</p>
        <a href="/cart" className="text-blue-600 hover:underline">
          Volver al carrito
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="mb-8 text-2xl font-bold">Finalizar compra</h1>
        <div className="grid gap-8 md:grid-cols-2">
          {/* Formulario */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit}>
              <div>
                <h2 className="mb-4 text-lg font-semibold">Datos de envío</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      data-testid="checkout-name"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      data-testid="checkout-email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="juan@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="099123456"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Dirección
                    </label>
                    <input
                      type="text"
                      data-testid="checkout-address"
                      required
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Av. Italia 1234"
                    />
                  </div>
                </div>
              </div>

              {/* Selector de método de envío */}
              {shippingMethods.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">
                    Método de envío
                  </h2>
                  <div className="space-y-3">
                    {shippingMethods.map((method) => {
                      const isFree =
                        method.freeShippingThreshold !== null &&
                        cartTotal >= method.freeShippingThreshold
                      const effectivePrice = isFree ? 0 : method.price
                      return (
                        <label
                          key={method.id}
                          data-testid="shipping-method"
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                            selectedShippingId === method.id
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="shippingMethod"
                            value={method.id}
                            checked={selectedShippingId === method.id}
                            onChange={() => setSelectedShippingId(method.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{method.name}</span>
                              <span className="font-semibold text-blue-700">
                                {effectivePrice === 0 ? (
                                  <span className="text-green-600">Gratis</span>
                                ) : (
                                  `$${(effectivePrice / 100).toFixed(2)}`
                                )}
                              </span>
                            </div>
                            {method.description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {method.description}
                              </p>
                            )}
                            {method.estimatedDaysMin &&
                              method.estimatedDaysMax && (
                                <p className="mt-1 text-xs text-gray-400">
                                  {method.estimatedDaysMin ===
                                  method.estimatedDaysMin
                                    ? `${method.estimatedDaysMin} día${method.estimatedDaysMin > 1 ? 's' : ''} hábil${method.estimatedDaysMin > 1 ? 'es' : ''}`
                                    : `${method.estimatedDaysMin} a ${method.estimatedDaysMax} días hábiles`}
                                </p>
                              )}
                            {isFree && (
                              <p className="mt-1 text-xs text-green-600">
                                ✓ Envío gratis aplicado
                              </p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                data-testid="checkout-submit"
                disabled={processing || items.length === 0}
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                {processing
                  ? 'Procesando...'
                  : `Pagar $${(total / 100).toFixed(2)}`}
              </button>
            </form>
          </div>

          {/* Resumen */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Resumen del pedido</h2>
            <div className="space-y-4 rounded-lg bg-white p-4 shadow">
              {items.map((item) => (
                <div key={item.variantId} className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-gray-500">
                      Cantidad: {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">
                    ${((item.product.price * item.quantity) / 100).toFixed(2)}
                  </p>
                </div>
              ))}

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${(cartTotal / 100).toFixed(2)}</span>
                </div>
                {selectedMethod && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Envío ({selectedMethod.name})</span>
                    <span>
                      {shippingCost === 0 ? (
                        <span className="text-green-600">Gratis</span>
                      ) : (
                        `$${(shippingCost / 100).toFixed(2)}`
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Total</span>
                  <span>${(total / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
