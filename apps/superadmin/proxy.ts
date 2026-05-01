import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  // En producción agregar: "superadmin.tudominio.com"
];

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");

  const isAllowed =
    ALLOWED_HOSTS.includes(host) ||
    (process.env.SUPERADMIN_HOST && host === process.env.SUPERADMIN_HOST);

  if (!isAllowed) {
    console.warn(`[Superadmin Proxy] Host no permitido: ${host}`);
    return NextResponse.json(
      { error: "Acceso no permitido desde este dominio" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}
