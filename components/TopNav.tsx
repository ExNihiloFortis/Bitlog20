// ===================== /components/TopNav.tsx =====================
// Barra superior unificada (BitLog)
// - Home, Trades, New, Field Edits, Import, Charts, Fundamental, Buscar ticket
// - Usa .btn-nav (rectangular) y valida ticket por regex.
// ================================================================

"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isValidTicket } from "@/lib/validateTicket";

type NavLink = {
  href: string;
  label: string;
  isFundamental?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/trades", label: "Trades" },
  { href: "/trades/new", label: "New" },
  { href: "/field-edits", label: "Field Edits" },
  { href: "/import", label: "Import" },
  { href: "/charts", label: "Charts" },
  { href: "/checklist", label: "Checklist" },
  { href: "/calendar", label: "Calendar" },
  { href: "/fundamental", label: "Fundamental", isFundamental: true },
];

export default function TopNav() {
  const [ticket, setTicket] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ticket.trim();
    if (!trimmed) return;

    if (!isValidTicket(trimmed)) {
      alert("Ticket inválido. Revisa el formato.");
      return;
    }

    router.push(`/trades/${encodeURIComponent(trimmed)}`);
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav
      style={{
        borderBottom: "1px solid #111827",
        background: "#020617",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {/* Lado izquierdo: logo + links */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 0.5,
            marginRight: 8,
          }}
        >
          Bitlog 2.0
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);

            // Estilo base igual que otros .btn-nav
            const baseClass = "btn-nav";
            const baseStyle: React.CSSProperties = {
              padding: "6px 12px",
              fontSize: 13,
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0,
            };

            // Normal (azul) o Fundamental (rojo cereza #da3c3c)
            let style: React.CSSProperties = { ...baseStyle };
            if (link.isFundamental) {
              // Botón FUNDAMENTAL siempre rojo cereza
              style = {
                ...style,
                backgroundColor: active ? "#da3c3c" : "#da3c3c",
                borderColor: "#da3c3c",
                color: "#ffffff",
                fontWeight: 600,
              };
            } else if (active) {
              // Activo normal (azul)
              style = {
                ...style,
                backgroundColor: "#1d4ed8",
                borderColor: "#1d4ed8",
                color: "#ffffff",
                fontWeight: 600,
              };
            }

            return (
              <button
                key={link.href}
                className={baseClass}
                style={style}
                onClick={() => router.push(link.href)}
                type="button"
              >
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lado derecho: buscador de ticket */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <form
          onSubmit={goSearch}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            placeholder="Buscar ticket..."
            style={{
              height: 30,
              padding: "0 10px",
              borderRadius: 4,
              border: "1px solid #374151",
              background: "#020617",
              color: "#e5e7eb",
              fontSize: 12,
              minWidth: 140,
            }}
          />
          <button
            className="btn-nav"
            type="submit"
            style={{ height: 30, padding: "0 10px" }}
          >
            🔍
          </button>
        </form>
      </div>
    </nav>
  );
}

