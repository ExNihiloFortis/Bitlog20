// ===================== [1] /components/TopNav.tsx =====================
// [1.1] Barra superior minimalista (mismo look sobrio del sitio)
// - Home, Trades, New, Field Edits, Import, Charts, Buscar (por ticket)
// - No rompe estilos existentes; usa clases base ya presentes.
// ======================================================================

"use client";

import React, { useState } from "react";

export default function TopNav() {
  const [ticket, setTicket] = useState("");

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = ticket.trim();
    if (!t) return;
    // navegamos a /trades?ticket=XXXX (lo soportamos en la página de /trades)
    const url = `/trades?ticket=${encodeURIComponent(t)}`;
    window.location.href = url;
  }

  const link = (href: string, label: string) => (
    <a className="nav-link" href={href} style={{ marginRight: 10 }}>
      {label}
    </a>
  );

  return (
    <div className="topnav" style={{ padding: "10px 12px", borderBottom: "1px solid #2a2f3a" }}>
      {link("/", "Home")}
      {link("/trades", "Trades")}
      {link("/trades/new", "New")}
      {link("/field-edits", "Field Edits")}
      {link("/import", "Import")}
      {link("/charts", "Charts")}

      <form onSubmit={goSearch} style={{ display: "inline-flex", gap: 6, marginLeft: 16 }}>
        <input
          className="input"
          placeholder="Buscar ticket…"
          value={ticket}
          onChange={(e) => setTicket(e.target.value)}
          style={{ height: 30 }}
        />
        <button className="btn" type="submit" style={{ height: 30 }}>
          🔍
        </button>
      </form>
    </div>
  );
}

