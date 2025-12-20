// [B1] Layout raíz con CSS global --------------------------------------------
import "./globals.css";
import type { Metadata } from "next";

// Sube este número cuando cambies el favicon para romper caché
const FAVICON_V = "20251220-1";

export const metadata: Metadata = {
  title: "Bitlog 2.5",
  description: "Trading journal",
  icons: {
    icon: [{ url: `/favicon.ico?v=${FAVICON_V}` }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* A prueba de balas: forzamos el favicon con cache-bust */}
        <link rel="icon" href={`/favicon.ico?v=${FAVICON_V}`} sizes="any" />
        <link rel="shortcut icon" href={`/favicon.ico?v=${FAVICON_V}`} />
      </head>
      <body>{children}</body>
    </html>
  );
}

