'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import Link from 'next/link'

type BreadcrumbItem = {
  label: string
  href: string
}

type BreadcrumbsContextType = {
  items: BreadcrumbItem[]
  setItems: (items: BreadcrumbItem[]) => void
}

const BreadcrumbsContext = createContext<BreadcrumbsContextType | undefined>(
  undefined,
)

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([
    { label: 'Inicio', href: '/' },
  ])

  return (
    <BreadcrumbsContext.Provider value={{ items, setItems }}>
      {children}
    </BreadcrumbsContext.Provider>
  )
}

function useBreadcrumbs() {
  const context = useContext(BreadcrumbsContext)
  if (!context) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbsProvider')
  }
  return context
}

export function Breadcrumbs() {
  const { items } = useBreadcrumbs()

  return (
    <nav className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
      <div className="mx-auto max-w-6xl">
        <ol className="flex items-center text-sm">
          {items.map((item, index) => (
            <li key={item.href} className="flex items-center">
              {index > 0 && <span className="mx-2 text-zinc-400">/</span>}
              {index === items.length - 1 ? (
                <span className="font-medium text-zinc-700">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="text-zinc-500 hover:text-zinc-700"
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}

export function SetBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { setItems } = useBreadcrumbs()
  useEffect(() => {
    setItems(items)
  }, [items, setItems])
  return null
}
