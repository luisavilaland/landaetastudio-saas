"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  createdAt: Date;
};

export function TenantsTable({ initialTenants }: { initialTenants: Tenant[] }) {
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este tenant?")) return;

    try {
      const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTenants((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-UY");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <button
          onClick={() => router.push("/tenants/new")}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
        >
          Crear Tenant
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Plan</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-600">Creado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No hay tenants. Crea el primero.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-sm">{tenant.slug}</td>
                  <td className="px-4 py-3 text-sm">{tenant.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 text-xs rounded-full bg-zinc-200">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        tenant.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(tenant.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/tenants/${tenant.id}`)}
                      className="px-3 py-1 text-sm text-zinc-600 hover:text-zinc-900 mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}