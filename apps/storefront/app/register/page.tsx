"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar");
        return;
      }

      router.push("/login?registered=true");
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem" }}>
      <h1>Crear Cuenta</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        Regístrate para completar tu compra más rápido
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="name" style={{ display: "block", marginBottom: "0.5rem" }}>
            Nombre
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem" }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          />
        </div>

        {error && (
          <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Registrando..." : "Crear Cuenta"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" style={{ color: "#2563eb" }}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}