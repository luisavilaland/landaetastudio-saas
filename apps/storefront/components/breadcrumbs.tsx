"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BreadcrumbItem = {
  label: string;
  href: string;
};

export function Breadcrumbs() {
  const pathname = usePathname();

  const items: BreadcrumbItem[] = [{ label: "Inicio", href: "/" }];

  if (pathname.startsWith("/products/")) {
    const slug = pathname.split("/products/")[1];
    items.push({
      label: decodeURIComponent(slug),
      href: pathname,
    });
  }

  return (
    <nav className="px-6 py-3 bg-zinc-50 border-b border-zinc-200">
      <div className="max-w-6xl mx-auto">
        <ol className="flex items-center text-sm">
          {items.map((item, index) => (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-zinc-400">/</span>
              )}
              {index === items.length - 1 ? (
                <span className="text-zinc-700 font-medium">{item.label}</span>
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
  );
}