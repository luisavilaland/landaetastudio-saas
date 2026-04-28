import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/db";
import { dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");

  if (!domain || domain.trim() === "") {
    return NextResponse.json(
      { error: "Domain parameter is required" },
      { status: 400 }
    );
  }

  const trimmedDomain = domain.trim();

  const existing = await db
    .select({ id: dbTenants.id })
    .from(dbTenants)
    .where(eq(dbTenants.customDomain, trimmedDomain))
    .limit(1);

  return NextResponse.json({
    available: existing.length === 0,
    domain: trimmedDomain,
  });
}
