import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oficina Prime — Dashboard",
  description: "Métricas de leads y FTD por agente y oficina",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
