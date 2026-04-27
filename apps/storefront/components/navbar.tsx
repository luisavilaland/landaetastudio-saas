"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

type NavbarProps = {
  tenantName: string;
};

export function Navbar({ tenantName }: NavbarProps) {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-white border-b border-zinc-200 px-6 py-4 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold text-zinc-900 hover:text-zinc-700">
          {tenantName}
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
            Productos
          </Link>
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