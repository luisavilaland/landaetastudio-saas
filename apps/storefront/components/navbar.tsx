"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { SearchBar } from "./search-bar";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type NavbarProps = {
  tenantName: string;
  categories?: Category[];
};

export function Navbar({ tenantName, categories = [] }: NavbarProps) {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-white border-b border-zinc-200 px-6 py-4 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold text-zinc-900 hover:text-zinc-700">
          {tenantName}
        </Link>
        <div className="flex items-center gap-6">
          <SearchBar />
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
            Productos
          </Link>
          {categories.length > 0 && (
            <div className="relative group">
              <button className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1">
                Categorías
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute top-full left-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px]">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categoria/${category.slug}`}
                    className="block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Link
            href="/cart"
            className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Carrito
          </Link>
          {status === "loading" ? (
            <span className="text-sm text-zinc-400">...</span>
          ) : session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm text-zinc-600 hover:text-zinc-900"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}