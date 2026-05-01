"use client";

import { useState, useEffect } from "react";

type StoreSettings = {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  storeDescription?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
  };
};

const FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "system-ui",
  "-apple-system",
  "sans-serif",
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<StoreSettings>({
    logoUrl: "",
    primaryColor: "#6366f1",
    secondaryColor: "#8b5cf6",
    accentColor: "#ec4899",
    fontFamily: "Inter",
    storeDescription: "",
    contactEmail: "",
    contactPhone: "",
    socialLinks: {
      instagram: "",
      facebook: "",
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/store/settings");
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings || {});
        setFormData({
          logoUrl: data.settings?.logoUrl || "",
          primaryColor: data.settings?.primaryColor || "#6366f1",
          secondaryColor: data.settings?.secondaryColor || "#8b5cf6",
          accentColor: data.settings?.accentColor || "#ec4899",
          fontFamily: data.settings?.fontFamily || "Inter",
          storeDescription: data.settings?.storeDescription || "",
          contactEmail: data.settings?.contactEmail || "",
          contactPhone: data.settings?.contactPhone || "",
          socialLinks: {
            instagram: data.settings?.socialLinks?.instagram || "",
            facebook: data.settings?.socialLinks?.facebook || "",
          },
        });
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const payload: Record<string, unknown> = { ...formData };
      if (!payload.logoUrl) delete payload.logoUrl;
      const links = payload.socialLinks as StoreSettings["socialLinks"] | undefined;
      if ((!links?.instagram && !links?.facebook) || !links) {
        delete payload.socialLinks;
      }

      const res = await fetch("/api/store/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al guardar");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Configuración de la Tienda</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Logo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  URL del logo
                </label>
                <input
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Colores</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Color principal
                </label>
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="w-full h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md mt-1 text-sm"
                  placeholder="#6366f1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Color secundario
                </label>
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                  }
                  className="w-full h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md mt-1 text-sm"
                  placeholder="#8b5cf6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Color de acento
                </label>
                <input
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="w-full h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.accentColor}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md mt-1 text-sm"
                  placeholder="#ec4899"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Tipografía</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Familia de fuente
              </label>
              <select
                value={formData.fontFamily}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fontFamily: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Información de contacto</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Descripción de la tienda
                </label>
                <textarea
                  value={formData.storeDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      storeDescription: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Descripción corta de tu tienda..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Email de contacto
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="contacto@mitienda.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Teléfono de contacto
                </label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="+598 99 123 456"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-medium mb-4">Redes sociales</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Instagram
                </label>
                <input
                  type="url"
                  value={formData.socialLinks?.instagram}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      socialLinks: {
                        ...prev.socialLinks,
                        instagram: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://instagram.com/tienda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Facebook
                </label>
                <input
                  type="url"
                  value={formData.socialLinks?.facebook}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      socialLinks: {
                        ...prev.socialLinks,
                        facebook: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://facebook.com/tienda"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">Configuración guardada</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </form>

        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-medium mb-4">Vista previa</h2>
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: formData.secondaryColor
                ? `${formData.secondaryColor}20`
                : "#f5f5f5",
              fontFamily: formData.fontFamily || "Inter",
            }}
          >
            {formData.logoUrl && (
              <img
                src={formData.logoUrl}
                alt="Logo"
                className="h-12 w-auto mb-4"
              />
            )}
            <h3
              className="text-xl font-semibold mb-2"
              style={{ color: formData.primaryColor }}
            >
              Mi Tienda
            </h3>
            <p className="text-sm text-zinc-600 mb-4">
              {formData.storeDescription || "Descripción de tu tienda..."}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-white text-sm rounded"
                style={{ backgroundColor: formData.primaryColor }}
              >
                Botón principal
              </button>
              <button
                className="px-3 py-1 text-white text-sm rounded"
                style={{ backgroundColor: formData.accentColor }}
              >
                Acento
              </button>
            </div>
            {(formData.contactEmail || formData.contactPhone) && (
              <div className="mt-4 pt-4 border-t text-sm text-zinc-600">
                {formData.contactEmail && <p>{formData.contactEmail}</p>}
                {formData.contactPhone && <p>{formData.contactPhone}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}