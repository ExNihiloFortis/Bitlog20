// [B1] Layout raíz con CSS global --------------------------------------------
import "./globals.css"; // <= IMPORTANTE: garantiza estilos en prod

export const metadata = {
  title: "Bitlog 2.0",
  description: "Trading journal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

