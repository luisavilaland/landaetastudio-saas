import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-zinc-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Tu carrito está vacío</h1>
        <p className="mt-2 text-zinc-500">
          Aún no has agregado productos. Explora nuestro catálogo y añade lo que te
          guste.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}