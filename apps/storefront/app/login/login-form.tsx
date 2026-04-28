"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get("registered");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setError("Email o contraseña inválidos");
        return;
      }

      router.push("/");
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "2rem" }}>
      <h1>Iniciar Sesión</h1>
      
      {registered && (
        <div style={{ 
          background: "#dcfce7", 
          color: "#166534", 
          padding: "0.75rem", 
          borderRadius: "0.375rem",
          marginBottom: "1rem"
        }}>
          Cuenta creada exitosamente. Por favor iniciá sesión.
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
          {loading ? "Ingresando..." : "Iniciar Sesión"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        ¿No tenés cuenta?{" "}
        <Link href="/register" style={{ color: "#2563eb" }}>
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
