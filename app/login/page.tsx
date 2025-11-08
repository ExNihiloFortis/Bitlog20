// ===================== [4] app/login/page.tsx =====================
// [4.1] Login centrado tipo WP (card en medio). Fácil de estilizar con un fondo.
// ==================================================================

"use client";

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const [sb] = useState(()=> createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      window.location.href = "/trades";
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      backgroundSize: "cover",
      backgroundPosition: "center",
      // TODO: aquí podrás setear tu foto de fondo:
      // backgroundImage: 'url(/bg-login.jpg)'
    }}>
      <div className="form-card" style={{ width: 360, padding: 20 }}>
        <div className="form-head" style={{ justifyContent: "center" }}>
          <div className="form-title">Bitlog — Acceder</div>
        </div>
        <form className="form-body" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Contraseña</label>
            <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          </div>
          {err && <div className="hint" style={{ color:"#ef4444" }}>{err}</div>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

