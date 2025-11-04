// [BLOQUE 1] Imports ----------------------------------------------------------
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

// [BLOQUE 2] Fuentes válidas --------------------------------------------------
const inter = Inter({ subsets: ["latin"] });
const robotoMono = Roboto_Mono({ subsets: ["latin"] }); // sin 'variable'

// [BLOQUE 3] Metadata ---------------------------------------------------------
export const metadata: Metadata = {
  title: "Bitlog 2.0",
  description: "Bitlog — MVP",
};

// [BLOQUE 4] Layout raíz ------------------------------------------------------
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} ${robotoMono.className}`}>
        {children}
      </body>
    </html>
  );
}

