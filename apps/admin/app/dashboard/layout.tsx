import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
            <span className="text-sm text-zinc-600">{session.user?.email}</span>
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}