// ===================== [B1] Modo cliente =====================
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ===================== [B2] UI mínima: TopNav =================
function TopNav() {
  return (
    <nav className="topnav" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      <a className="btn link" href="/">Home</a>
      <a className="btn link" href="/trades">Trades</a>
      <a className="btn link" href="/trades/new">New</a>
      <a className="btn link" href="/field-edits">Field Edits</a>
      <a className="btn link" href="/import">Import</a>
      <a className="btn link" href="/charts">Charts</a>
    </nav>
  );
}

// ===================== [B3] Página Login =====================
export default function LoginPage() {
  // [B3.1] Anti-hydration: renderiza SOLO tras montar en cliente
  const [mounted, setMounted] = useState(false);

  // [B3.2] Form state
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();
  
  
  
  
  
  
  
  
 // Estado de sesión
const [sessionUser, setSessionUser] = useState<any>(null);

useEffect(() => {
  setMounted(true);
}, []);

useEffect(() => {
  if (!mounted) return;
  (async () => {
    const { data } = await supabase.auth.getUser();
    setSessionUser(data.user ?? null);
  })();
}, [mounted]);

async function doSignOut() {
  await supabase.auth.signOut();
  setSessionUser(null);
}
 
  














  // [B3.4] Handler submit
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) {
        setErr(error.message);
      } else if (data.user) {
        router.replace("/trades");
      } else {
        setErr("No se pudo iniciar sesión.");
      }
    } catch (ex: any) {
      setErr(String(ex?.message ?? ex));
    } finally {
      setLoading(false);
    }
  }

  // [B3.5] Anti-hydration: mientras no ha montado, no pintes nada
  if (!mounted) {
    return (
      <div className="container">
        <TopNav />
        <div className="card"><p>Cargando…</p></div>
      </div>
    );
  }

  // ===================== [B3.6] UI =====================
  return (
    <div className="container" style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
      <TopNav />
      <div className="card" style={{ width: 420, maxWidth: "92vw", padding: 20 }}>
        <h1 className="title" style={{ textAlign: "center", marginBottom: 12 }}>Iniciar sesión</h1>

        {err && (
          <div
            style={{
              background: "#3b1f1f",
              color: "#fca5a5",
              border: "1px solid #7f1d1d",
              padding: "8px 10px",
              borderRadius: 8,
              marginBottom: 10,
              fontSize: 14,
            }}
          >
            {err}
          </div>
        )}
        
        
        
        
        
        

{sessionUser && (
  <div
    style={{
      background: "#1f2d3a",
      border: "1px solid #2a3f50",
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      display: "flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <div>Ya iniciaste sesión como <b>{sessionUser.email}</b>.</div>
    <div className="btn-row" style={{ gap: 8 }}>
      <a className="btn" href="/trades">Ir a Trades</a>
      <button className="btn secondary" type="button" onClick={doSignOut}>Cerrar sesión</button>
    </div>
  </div>
)}












        <form onSubmit={onSubmit}>
          <div className="field">
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@dominio.com"
              required
            />
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <div className="label">Contraseña</div>
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

