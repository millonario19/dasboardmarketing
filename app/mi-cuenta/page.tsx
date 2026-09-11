"use client";

import { useState } from "react";
import Link from "next/link";
import { useSesion } from "@/components/useSesion";

const CAMPO =
  "w-full border border-gridline rounded-lg px-3 py-2.5 text-sm bg-surface outline-none focus:border-series1";

export default function MiCuentaPage() {
  const sesion = useSesion();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const esAdmin = sesion?.rol === "admin";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva !== repetida) {
      setError("Las dos contraseñas nuevas no coinciden");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/mi-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo cambiar la contraseña");
      setActual("");
      setNueva("");
      setRepetida("");
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-ink-primary tracking-tight">Mi cuenta</h1>
        <Link
          href="/mi-dia"
          className="bg-surface border border-gridline rounded-full px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary"
        >
          ← Volver
        </Link>
      </div>

      {sesion && (
        <p className="text-sm text-ink-secondary mb-6">
          Entraste como <span className="font-semibold text-ink-primary">{sesion.nombre}</span> (@
          {sesion.usuario}).
        </p>
      )}

      {esAdmin ? (
        <div className="bg-surface border border-gridline rounded-2xl p-5 text-sm text-ink-secondary">
          La contraseña de la dirección vive en la configuración del servidor, no en la base de datos.
          Es a propósito: así sigue funcionando aunque la base esté caída.
        </div>
      ) : (
        <form onSubmit={guardar} className="bg-surface border border-gridline rounded-2xl p-5 grid gap-4">
          <div className="text-sm font-semibold text-ink-primary">Cambiar mi contraseña</div>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-secondary">Contraseña actual</span>
            <input
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              className={CAMPO}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-secondary">Contraseña nueva</span>
            <input
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              className={CAMPO}
            />
            <span className="text-[11px] text-ink-secondary">Al menos 6 caracteres.</span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-secondary">Repetila</span>
            <input
              type="password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              className={CAMPO}
            />
          </label>

          {error && <p className="text-sm text-series2">{error}</p>}
          {listo && (
            <p className="text-sm font-medium" style={{ color: "#157F52" }}>
              ✓ Listo. La próxima vez entrá con la contraseña nueva.
            </p>
          )}

          <button
            type="submit"
            disabled={guardando || !actual || !nueva || !repetida}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#17457F" }}
          >
            {guardando ? "Guardando…" : "Cambiar contraseña"}
          </button>

          <p className="text-[12px] text-ink-secondary leading-relaxed">
            Si la olvidás, la dirección te pone una nueva desde la pantalla de Usuarios. Nadie puede
            ver la que tenés puesta, ni siquiera la dirección: en la base queda guardada de una forma
            que no se puede revertir.
          </p>
        </form>
      )}
    </main>
  );
}
