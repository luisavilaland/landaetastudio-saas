'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { captureException } from '@sentry/nextjs'

type Props = {
  variantId: string
  inStock: boolean
}

export function AddToCartButton({ variantId, inStock }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)

  const handleAddToCart = async () => {
    if (!inStock) return

    setLoading(true)
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, quantity: 1 }),
      })

      if (res.ok) {
        setAdded(true)
        setTimeout(() => {
          router.refresh()
        }, 1500)
      }
    } catch (error) {
      captureException(error)
    } finally {
      setLoading(false)
    }
  }

  if (added) {
    return (
      <Link
        href="/cart"
        className="block w-full rounded-lg bg-green-600 px-6 py-3 text-center font-medium text-white hover:bg-green-700"
      >
        ✓ Agregado al carrito
      </Link>
    )
  }

  return (
    <button
      onClick={handleAddToCart}
      data-testid="add-to-cart"
      disabled={!inStock || loading}
      className={`block w-full rounded-lg px-6 py-3 text-center font-medium ${
        inStock
          ? 'bg-zinc-900 text-white hover:bg-zinc-800'
          : 'cursor-not-allowed bg-zinc-200 text-zinc-400'
      }`}
    >
      {loading ? 'Agregando...' : inStock ? 'Agregar al carrito' : 'Agotado'}
    </button>
  )
}
