'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ShoppingCart, Search, ChevronDown } from 'lucide-react'

type CategoryData = {
  id: string
  name: string
  slug: string
}

export default function Navbar({
  tenantName,
  logoUrl,
  categories,
}: {
  tenantName?: string
  logoUrl?: string | null
  categories?: CategoryData[]
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center whitespace-nowrap">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={tenantName || 'Tienda'}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <span className="text-xl font-bold">{tenantName || 'Tienda'}</span>
          )}
        </Link>

        <Link
          href="/perfil"
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          Perfil
        </Link>

        <div className="flex flex-1 items-center justify-center gap-4">
          {/* Categories Dropdown */}
          {categories && categories.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                data-testid="nav-categories"
                className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
                onBlur={() => setTimeout(() => setIsCategoriesOpen(false), 200)}
              >
                Categorías
                <ChevronDown className="h-4 w-4" />
              </button>

              {isCategoriesOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-md border bg-white py-1 shadow-lg">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/?category=${cat.slug}`}
                      className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setIsCategoriesOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-md flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                data-testid="search-input"
                className="w-full rounded-md border border-zinc-300 px-4 py-2 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-zinc-900 focus:outline-none"
              />
              <button
                type="submit"
                data-testid="search-submit"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-4 whitespace-nowrap">
          <Link href="/cart" className="relative" data-testid="nav-cart">
            <ShoppingCart className="h-6 w-6" />
          </Link>

          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
