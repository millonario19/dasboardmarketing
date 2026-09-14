"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEntrando(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Usuario o contraseña incorrectos");
        return;
      }
      // Cada rol arranca en su pantalla: la dirección en el tablero, el agente
      // en su lista de trabajo.
      // Sesión nueva, avisos nuevos: el que vuelve a entrar merece que el
      // recordatorio de las bajadas le salga otra vez.
      try {
        sessionStorage.removeItem("op_confirmar_avisos");
      } catch {
        /* modo privado */
      }
      router.push(data.destino ?? "/");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setEntrando(false);
    }
  }

  const campo =
    "w-full border border-gridline rounded-md px-3 py-2 mb-3 outline-none focus:border-series1";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-gridline rounded-lg p-8 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-lg font-semibold mb-1">Oficina Prime</h1>
        <p className="text-sm text-ink-secondary mb-6">Marketing y ventas</p>

        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuario"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          className={campo}
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          className={campo}
        />

        {error && <p className="text-sm text-series2 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={entrando || !usuario || !password}
          className="w-full bg-series1 text-white rounded-md py-2 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
