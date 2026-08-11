import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import LogoutButton from '@/components/logout-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-zinc-900 text-white">
        <div className="border-b border-zinc-700 p-4">
          <h1 className="text-lg font-semibold">SuperAdmin</h1>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          <Link
            href="/tenants"
            className="block rounded px-4 py-2 hover:bg-zinc-800"
          >
            Tenants
          </Link>
          <Link
            href="/plans"
            className="block rounded px-4 py-2 hover:bg-zinc-800"
          >
            Planes
          </Link>
        </nav>
        <div className="border-t border-zinc-700 p-4">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">{session.user?.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
