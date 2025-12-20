// ===================== /components/TopNav.tsx =====================
// Barra superior unificada (BitLog)
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
  { href: "/field-edits", label: "F.Edits" },
  { href: "/import", label: "Import" },
  { href: "/checklist", label: "Chklist" },
  { href: "/calendar", label: "Cal" },
  { href: "/journal", label: "Jrnl" },
  { href: "/charts", label: "Charts" },
  { href: "/fundamental", label: "News", isFundamental: true },
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
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav
      style={{
        width: "100%",
        background: "#020617",
        borderBottom: "1px solid #111827",
        padding: "10px 0",
      }}
    >
      {/* Wrapper centrado */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {/* Menú */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "nowrap",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);

            const baseStyle: React.CSSProperties = {
              padding: "6px 12px",
              fontSize: 13,
              height: 32,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0,
              border: "1px solid transparent",
              whiteSpace: "nowrap",
            };

            let style: React.CSSProperties = { ...baseStyle };

            if (link.isFundamental) {
              style = {
                ...style,
                backgroundColor: "#da3c3c",
                borderColor: "#da3c3c",
                color: "#ffffff",
                fontWeight: 600,
              };
            } else if (active) {
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
                className="btn-nav"
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
    </nav>
  );
}

