"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* =========================
   TOP NAV (estilo charts)
   ========================= */
function TopNav() {
  return (
    <nav className="topnav" style={{ marginBottom: 12 }}>
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
      </div>
    </nav>
  );
}

export default function ImportPage() {
  const [mounted, setMounted] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setSessionOk(!!data.user);
    })();
  }, [mounted]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement)?.files?.[0];
    if (!file) { setMsg("Selecciona un CSV"); return; }

    setLoading(true);
    try {
      // 1) Sesión y token
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setMsg("No hay sesión. Inicia en /login"); return; }

      // 2) FormData (sin especificar Content-Type manualmente)
      const fd = new FormData();
      fd.append("file", file);

      // 3) URL ABSOLUTA del Edge Function + headers obligatorios
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import_csv`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: fd,
      });

      const ctype = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const raw = ctype.includes("application/json") ? await resp.json() : await resp.text();
        console.error("Import error:", raw);
        setMsg(`Error HTTP ${resp.status}. Revisa consola para detalle.`);
        return;
      }

      const data = ctype.includes("application/json") ? await resp.json() : await resp.text();
      // Resumen amigable si vino JSON
      if (ctype.includes("application/json")) {
        const inserted = data?.inserted ?? "—";
        const merged = data?.merged ?? "—";
        const skipped = data?.skipped_no_symbol ?? "—";
        setMsg(`OK: inserted=${inserted}, merged=${merged}, skipped_no_symbol=${skipped}`);
      } else {
        // Si por alguna razón llegó texto, lo mostramos sin romper UI
        setMsg(typeof data === "string" ? data.slice(0, 500) : "Importación completada.");
      }
    } catch (err: any) {
      setMsg(`Error: ${String(err?.message ?? err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <TopNav />
      <div className="card" style={{ maxWidth: 640 }}>
        <h1 className="title">Importar CSV</h1>
        {!sessionOk && (
          <p style={{ color: "#f99" }}>
            No hay sesión. Inicia en <a className="btn link" href="/login">/login</a>
          </p>
        )}
        <form onSubmit={onUpload}>
          <div className="field">
            <div className="label">Archivo CSV</div>
            <input className="input" type="file" name="file" accept=".csv,text/csv" />
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={!sessionOk || loading}>
              {loading ? "Importando…" : "Importar"}
            </button>
          </div>
        </form>
        {msg && <p style={{ marginTop: 10, opacity: 0.9, whiteSpace: "pre-wrap" }}>{msg}</p>}
      </div>
    </div>
  );
}

