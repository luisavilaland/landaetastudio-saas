import { NextRequest, NextResponse } from "next/server";
import { db } from '@repo/db';
import { dbTenants } from '@repo/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get('domain');

  if (!domain || domain.trim() === '') {
return NextResponse.json({ error: 'El parámetro domain es requerido' }, { status: 400 });
  }

  const trimmedDomain = domain.trim();

  const existing = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.customDomain, trimmedDomain))
    .limit(1);

  const available = existing.length === 0;

return NextResponse.json({ available });
}
