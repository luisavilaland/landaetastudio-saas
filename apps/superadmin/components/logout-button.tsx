'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full rounded px-4 py-2 text-left hover:bg-zinc-800"
    >
      Cerrar sesión
    </button>
  )
}
