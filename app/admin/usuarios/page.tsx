"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Usuario } from "@/lib/usuarios";
import type { UsuarioGhl } from "@/lib/ghl";

type Datos = { usuarios: Usuario[]; agentes: UsuarioGhl[] };

const CAMPO =
  "w-full border border-gridline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-series1";

export default function UsuariosPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    fetch("/api/usuarios")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error al cargar los usuarios");
        return r.json();
      })
      .then((d: Datos) => {
        setDatos(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <h1 className="text-3xl font-semibold text-ink-primary tracking-tight">Usuarios</h1>
        <Link
          href="/"
          className="bg-surface border border-gridline rounded-full px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-page hover:text-ink-primary"
        >
          ← Volver al tablero
        </Link>
      </div>
      <p className="text-sm text-ink-secondary mb-7 max-w-2xl">
        Cada usuario se ata a un agente de GHL: eso es lo que hace que al entrar vea solo sus leads.
        Si le dejás la contraseña vacía, entra con la contraseña común del equipo.
      </p>

      {error && (
        <div className="bg-surface border border-series2 text-series2 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      <NuevoUsuario agentes={datos?.agentes ?? []} onCreado={cargar} />

      {cargando && !datos ? (
        <p className="text-sm text-ink-secondary">Cargando…</p>
      ) : (
        <Lista usuarios={datos?.usuarios ?? []} agentes={datos?.agentes ?? []} onCambio={cargar} />
      )}
    </main>
  );
}

function NuevoUsuario({ agentes, onCreado }: { agentes: UsuarioGhl[]; onCreado: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [agentId, setAgentId] = useState("");
  const [clave, setClave] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Elegir el agente completa el nombre: es el nombre que ya usa el resto del
  // dashboard, y tipearlo distinto solo genera dos nombres para la misma persona.
  function elegirAgente(id: string) {
    setAgentId(id);
    const agente = agentes.find((a) => a.id === id);
    if (agente && !nombre.trim()) setNombre(agente.nombre);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, nombre, agentId, rol: "agente", clave: clave || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el usuario");
      setUsuario("");
      setNombre("");
      setAgentId("");
      setClave("");
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={crear}
      className="bg-surface border border-gridline rounded-2xl p-5 mb-8 grid gap-3 sm:grid-cols-2"
    >
      <div className="sm:col-span-2 text-sm font-semibold text-ink-primary">Agregar una persona</div>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Agente de GHL</span>
        <select value={agentId} onChange={(e) => elegirAgente(e.target.value)} className={CAMPO}>
          <option value="">Elegir…</option>
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Nombre que ve la persona</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Usuario para entrar</span>
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value.toLowerCase())}
          placeholder="tatiana"
          autoCapitalize="none"
          autoCorrect="off"
          className={CAMPO}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">
          Contraseña propia <span className="font-normal">(vacío = la del equipo)</span>
        </span>
        <input
          type="text"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="—"
          className={CAMPO}
        />
      </label>

      {error && <p className="sm:col-span-2 text-sm text-series2">{error}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={guardando || !usuario || !nombre || !agentId}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#17457F" }}
        >
          {guardando ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}

function Lista({
  usuarios,
  agentes,
  onCambio,
}: {
  usuarios: Usuario[];
  agentes: UsuarioGhl[];
  onCambio: () => void;
}) {
  if (usuarios.length === 0) {
    return (
      <p className="text-sm text-ink-secondary">
        Todavía no hay usuarios. Creá el primero con el formulario de arriba.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {usuarios.map((u) => (
        <Fila key={u.id} usuario={u} agentes={agentes} onCambio={onCambio} />
      ))}
    </div>
  );
}

function Fila({
  usuario,
  agentes,
  onCambio,
}: {
  usuario: Usuario;
  agentes: UsuarioGhl[];
  onCambio: () => void;
}) {
  const [clave, setClave] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const agente = agentes.find((a) => a.id === usuario.agentId);

  async function cambiar(cuerpo: Record<string, unknown>, mensaje: string) {
    setOcupado(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "No se pudo guardar");
      setAviso(mensaje);
      setClave("");
      onCambio();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div
      className={`bg-surface border border-gridline rounded-2xl p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center ${
        usuario.activo ? "" : "opacity-60"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-ink-primary">{usuario.nombre}</span>
          <span className="text-sm text-ink-secondary">@{usuario.usuario}</span>
          {!usuario.activo && (
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-page text-ink-secondary">
              Sin acceso
            </span>
          )}
        </div>
        <div className="text-xs text-ink-secondary mt-1">
          {agente ? `Ve los leads de ${agente.nombre}` : `Agente ${usuario.agentId}`} ·{" "}
          {usuario.clavePropia ? "contraseña propia" : "contraseña del equipo"}
        </div>
        {aviso && <div className="text-xs text-ink-secondary mt-1.5">{aviso}</div>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Nueva contraseña"
          className="border border-gridline rounded-full px-3 py-1.5 text-sm w-40 outline-none focus:border-series1"
        />
        <button
          onClick={() => cambiar({ clave }, "Contraseña actualizada")}
          disabled={ocupado || !clave}
          className="text-sm font-semibold rounded-full px-3 py-1.5 text-white disabled:opacity-40"
          style={{ background: "#17457F" }}
        >
          Guardar
        </button>
        {usuario.clavePropia && (
          <button
            onClick={() => cambiar({ clave: "" }, "Vuelve a la contraseña del equipo")}
            disabled={ocupado}
            className="text-sm rounded-full px-3 py-1.5 border border-gridline text-ink-secondary hover:bg-page disabled:opacity-40"
          >
            Usar la del equipo
          </button>
        )}
        <button
          onClick={() =>
            cambiar(
              { activo: !usuario.activo },
              usuario.activo ? "Ya no puede entrar" : "Puede entrar de nuevo"
            )
          }
          disabled={ocupado}
          className="text-sm rounded-full px-3 py-1.5 border border-gridline text-ink-secondary hover:bg-page disabled:opacity-40"
        >
          {usuario.activo ? "Quitar acceso" : "Dar acceso"}
        </button>
      </div>
    </div>
  );
}
