// ===================== /components/TopNav.tsx =====================
// Barra superior unificada (BitLog)
// - Home, Trades, New, Field Edits, Import, Charts, Buscar ticket
// - Usa .btn-nav (rectangular) y valida ticket por regex.
// ================================================================

"use client";

import React, { useState } from "react";
import { isValidTicket } from "@/lib/validateTicket";

export default function TopNav() {
  const [ticket, setTicket] = useState("");

  function goSearch(e: React.FormEvent) {
    e.preventDefault();
    const t = ticket.trim();
    if (!t) return;

    if (!isValidTicket(t)) {
      alert("Ticket inválido. Usa solo letras, números, guiones y máximo 40 caracteres.");
      return;
    }

    const url = `/trades?ticket=${encodeURIComponent(t)}`;
    window.location.href = url;
  }

  return (
    <nav
      className="topnav"
      style={{
        marginBottom: 12,
        padding: "8px 12px",
        borderBottom: "1px solid #2a2f3a",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        {/* Links principales */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a className="btn-nav" href="/">Home</a>
          <a className="btn-nav" href="/trades">Trades</a>
          <a className="btn-nav" href="/trades/new">New</a>
          <a className="btn-nav" href="/field-edits">Field Edits</a>
          <a className="btn-nav" href="/import">Import</a>
          <a className="btn-nav" href="/charts">Charts</a>
          <a className="btn-nav" href="/checklist">Checklist</a>
        </div>

        {/* Buscar ticket */}
        <form
          onSubmit={goSearch}
          style={{
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="Buscar ticket…"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            style={{ height: 30, minWidth: 140 }}
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

