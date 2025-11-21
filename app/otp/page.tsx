// app/otp/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

export default function OtpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/");
        return;
      }
      setCheckingSession(false);
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const c = code.trim();
    if (!c) {
      setMsg("Ingresa el código que recibiste.");
      return;
    }

    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setMsg("Sesión inválida. Vuelve a iniciar sesión.");
        return;
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify_otp`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: c }),
      });

      const raw = await resp.json().catch(() => ({}));
      if (!resp.ok || !raw.ok) {
        setMsg(raw.error || "Código inválido o expirado.");
        return;
      }

      // OTP correcto: ahora sí pasamos al dashboard
      router.push("/trades");
    } catch (err: any) {
      setMsg(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="container">
        <TopNav />
        <div className="card">
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="home-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#05070b",
      }}
    >
      <TopNav />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          className="card"
          style={{
            width: "100%",
            maxWidth: 380,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            background:
              "linear-gradient(145deg, rgba(4,7,15,0.98), rgba(10,14,26,0.98))",
            boxShadow: "0 18px 45px rgba(0,0,0,0.7)",
            padding: 20,
          }}
        >
          <h1
            className="title"
            style={{ fontSize: 20, marginBottom: 8, textAlign: "center" }}
          >
            Verificación 2FA
          </h1>
          <p
            style={{
              fontSize: 13,
              opacity: 0.8,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Ingresa el código de verificación que recibiste.
          </p>

          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label">Código</label>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>

            <div
              className="btn-row"
              style={{ marginTop: 16, justifyContent: "flex-end" }}
            >
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Verificando…" : "Verificar"}
              </button>
            </div>
          </form>

          {msg && (
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#f99",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

