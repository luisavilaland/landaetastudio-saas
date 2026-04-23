import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import LogoutButton from "@/components/logout-button";

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
    <div className="min-h-screen flex">
      <aside className="w-64 bg-zinc-900 text-white flex flex-col">
        <div className="p-4 border-b border-zinc-700">
          <h1 className="text-lg font-semibold">SuperAdmin</h1>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <Link href="/tenants" className="block px-4 py-2 rounded hover:bg-zinc-800">
            Tenants
          </Link>
          <Link href="/plans" className="block px-4 py-2 rounded hover:bg-zinc-800">
            Planes
          </Link>
        </nav>
        <div className="p-4 border-t border-zinc-700">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">{session.user?.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}