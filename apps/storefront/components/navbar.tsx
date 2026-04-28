"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingCart, Search, ChevronDown } from "lucide-react";

type CategoryData = {
  id: string;
  name: string;
  slug: string;
};

export default function Navbar({ 
  tenantName, 
  categories 
}: { 
  tenantName?: string; 
  categories?: CategoryData[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/buscar?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="bg-white border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold whitespace-nowrap">
          {tenantName || "Tienda"}
        </Link>

        <div className="flex items-center gap-4 flex-1 justify-center">
          {/* Categories Dropdown */}
          {categories && categories.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
                onBlur={() => setTimeout(() => setIsCategoriesOpen(false), 200)}
              >
                Categorías
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {isCategoriesOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg py-1 min-w-[200px] z-50">
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
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full px-4 py-2 pr-10 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-4 whitespace-nowrap">
          <Link href="/cart" className="relative">
            <ShoppingCart className="w-6 h-6" />
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
              <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900">
                Iniciar sesión
              </Link>
              <Link href="/register" className="text-sm bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800">
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}