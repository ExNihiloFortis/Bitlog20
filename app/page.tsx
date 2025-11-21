// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

// Cambia estas rutas cuando quieras otra imagen
const HERO_IMAGE = "/images/3.png";   // Imagen grande del Home
const LOGIN_IMAGE = "/images/4.png";  // Imagen dentro del cuadro de login

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setMsg("Ingresa tu email y contraseña.");
      return;
    }

    setLoading(true);
    try {
      // 1) Login normal con password
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        setMsg(error.message || "Error al iniciar sesión.");
        return;
      }

      // 2) Pedimos OTP (2FA)
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setMsg("Sesión inválida después de login.");
        return;
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request_otp`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });

      const raw = await resp.json().catch(() => ({}));

      if (!resp.ok || !raw.ok) {
        setMsg(raw.error || "No se pudo generar el código 2FA.");
        return;
      }

      // Para pruebas, puedes ver el código en consola:
      if (raw.code) {
        console.log("OTP (solo pruebas):", raw.code);
      }

      // 3) Redirigimos a pantalla OTP
      router.push("/otp");
    } catch (err: any) {
      setMsg(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
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
      {/* Top navigation unificado */}
      <TopNav />

      {/* Contenido principal */}
      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)",
          gap: 24,
          padding: "16px 20px 24px",
        }}
      >
        {/* Columna izquierda: hero */}
        <section
          style={{
            position: "relative",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.15))",
            }}
          />
          <div
            style={{
              position: "relative",
              padding: "18px 20px",
              color: "white",
            }}
          >
            <div
              style={{
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              Ex Nihilo Fortis
            </div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                marginTop: 4,
                marginBottom: 8,
              }}
            >
              BitLog Trading Journal
            </h1>
            <p
              style={{
                fontSize: 13,
                maxWidth: 420,
                opacity: 0.9,
              }}
            >
              Diario de trading, estadísticas avanzadas y confluencias en un
              solo lugar. Diseñado para operar como sniper, no como jugador de
              casino.
            </p>
          </div>
        </section>

        {/* Columna derecha: cuadro de login estilo WordPress */}
        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)",
              background:
                "linear-gradient(145deg, rgba(4,7,15,0.98), rgba(10,14,26,0.98))",
              boxShadow: "0 18px 45px rgba(0,0,0,0.7)",
              padding: 20,
            }}
          >
            {/* Logo/imagen de login */}
            <div
              style={{
                width: "100%",
                marginBottom: 16,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backgroundImage: `url(${LOGIN_IMAGE})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>

            <h2
              className="title"
              style={{
                fontSize: 20,
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Acceso a BitLog
            </h2>
            <p
              style={{
                fontSize: 13,
                textAlign: "center",
                opacity: 0.8,
                marginBottom: 16,
              }}
            >
              Inicia sesión para ver tus trades, estadísticas y confluencias.
            </p>

            <form onSubmit={onLogin}>
              <div className="field">
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@example.com"
                />
              </div>

              <div className="field" style={{ marginTop: 10 }}>
                <label className="label">Contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div
                className="btn-row"
                style={{ marginTop: 16, justifyContent: "flex-end" }}
              >
                <button
                  className="btn"
                  type="submit"
                  disabled={loading}
                  style={{ borderRadius: 0 }}
                >
                  {loading ? "Entrando…" : "Iniciar sesión"}
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

            <div
              style={{
                marginTop: 14,
                fontSize: 11,
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              “Ex Nihilo Fortis” — De la nada, fuerte.
              <br />
              Cada trade es una iteración más hacia tu versión pro.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

