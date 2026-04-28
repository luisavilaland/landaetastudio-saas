import { headers } from "next/headers";
import Link from "next/link";
import { db, dbTenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { getCategoriesForTenant } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "";

  let tenantName = "Tienda";
  let description = "";

  if (tenantSlug) {
    try {
      const result = await db
        .select({
          name: dbTenants.name,
          settings: dbTenants.settings,
        })
        .from(dbTenants)
        .where(eq(dbTenants.slug, tenantSlug))
        .limit(1);

      if (result.length > 0) {
        tenantName = result[0].name;
        const settings = (result[0].settings as Record<string, unknown>) || {};
        description = (settings.storeDescription as string) || "";
      }
    } catch {
      // ignore
    }
  }

  return {
    title: tenantName,
    description: description || `Tienda online de ${tenantName}`,
  };
}

type CategoryData = {
  id: string;
  name: string;
  slug: string;
};

export default async function PerfilPage() {
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "";

  let tenantName = "Tienda";
  let logoUrl = "";
  let description = "";
  let contactEmail = "";
  let contactPhone = "";
  let socialLinks: { instagram?: string; facebook?: string } = {};
  let categories: CategoryData[] = [];

  if (tenantSlug) {
    try {
      const result = await db
        .select({
          id: dbTenants.id,
          name: dbTenants.name,
          settings: dbTenants.settings,
        })
        .from(dbTenants)
        .where(eq(dbTenants.slug, tenantSlug))
        .limit(1);

      if (result.length > 0) {
        tenantName = result[0].name;
        const settings = (result[0].settings as Record<string, unknown>) || {};
        logoUrl = (settings.logoUrl as string) || "";
        description = (settings.storeDescription as string) || "";
        contactEmail = (settings.contactEmail as string) || "";
        contactPhone = (settings.contactPhone as string) || "";
        socialLinks = (settings.socialLinks as { instagram?: string; facebook?: string }) || {};

        categories = await getCategoriesForTenant(result[0].id);
      }
    } catch {
      // ignore
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: tenantName,
    description: description,
    url: `https://${tenantSlug}.lvh.me:3000/perfil`,
    ...(logoUrl && { logo: logoUrl }),
    ...(contactEmail && { email: contactEmail }),
    ...(contactPhone && { telephone: contactPhone }),
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-white rounded-lg border p-8 space-y-8">
        {/* Header con logo y nombre */}
        <div className="flex items-center gap-6">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`Logo de ${tenantName}`}
              className="h-20 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{tenantName}</h1>
            {description && (
              <p className="mt-2 text-zinc-600">{description}</p>
            )}
          </div>
        </div>

        {/* Información de contacto */}
        {(contactEmail || contactPhone) && (
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3">Contacto</h2>
            <div className="space-y-2">
              {contactEmail && (
                <p className="text-sm text-zinc-600">
                  <span className="font-medium">Email:</span>{" "}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-zinc-900 hover:underline"
                  >
                    {contactEmail}
                  </a>
                </p>
              )}
              {contactPhone && (
                <p className="text-sm text-zinc-600">
                  <span className="font-medium">Teléfono:</span> {contactPhone}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Redes sociales */}
        {(socialLinks.instagram || socialLinks.facebook) && (
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3">Redes sociales</h2>
            <div className="flex gap-4">
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Instagram
                </a>
              )}
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Facebook
                </a>
              )}
            </div>
          </div>
        )}

        {/* Categorías */}
        {categories.length > 0 && (
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3">Categorías</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categoria/${cat.slug}`}
                  className="px-4 py-2 bg-zinc-100 rounded-md text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// TODO: ISR/Redis cache en Fase 5
