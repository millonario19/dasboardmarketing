"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Contraseña incorrecta");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-gridline rounded-lg p-8 w-full max-w-sm shadow-sm"
      >
        <h1 className="text-lg font-semibold mb-1">Oficina Prime</h1>
        <p className="text-sm text-ink-secondary mb-6">Dashboard de agentes y oficinas</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full border border-gridline rounded-md px-3 py-2 mb-3 outline-none focus:border-series1"
          autoFocus
        />
        {error && <p className="text-sm text-series2 mb-3">{error}</p>}
        <button
          type="submit"
          className="w-full bg-series1 text-white rounded-md py-2 font-medium hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
