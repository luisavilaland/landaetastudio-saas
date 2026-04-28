import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Admin</h1>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900">Dashboard</a>
             <a href="/products" className="text-sm text-zinc-600 hover:text-zinc-900">Productos</a>
             <a href="/categorias" className="text-sm text-zinc-600 hover:text-zinc-900">Categorías</a>
             <a href="/orders" className="text-sm text-zinc-600 hover:text-zinc-900">Órdenes</a>
             <a href="/shipping" className="text-sm text-zinc-600 hover:text-zinc-900">Envíos</a>
             <a href="/store/settings" className="text-sm text-zinc-600 hover:text-zinc-900">Configuración</a>
             <a href="/store/domain" className="text-sm text-zinc-600 hover:text-zinc-900">Dominio</a>
            <span className="text-sm text-zinc-600">{session.user?.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}