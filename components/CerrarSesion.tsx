"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Las dos pantallas tienen paletas distintas, así que el botón recibe su
// apariencia desde afuera y solo aporta el comportamiento.
export function CerrarSesion({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <button onClick={salir} disabled={saliendo} className={className} style={style}>
      {saliendo ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
