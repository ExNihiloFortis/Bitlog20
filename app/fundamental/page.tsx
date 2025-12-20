// app/fundamental/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";

type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string | null;
};

// Formatea la fecha/hora a tu zona horaria local (Mazatlán, UTC-7)
function formatMazatlan(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    hour12: true,
  });
}

export default function FundamentalPage() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchArticles(opts?: { q?: string }) {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (opts?.q) params.set("q", opts.q);

      const res = await fetch(`/api/fundamental/news?${params.toString()}`, {
        method: "GET",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      setArticles(data.articles || []);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || "Error al buscar noticias. Intenta de nuevo más tarde."
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      // Sin query -> búsqueda general
      fetchArticles();
    } else {
      fetchArticles({ q });
    }
  }

  // Al montar: cargar noticias generales
  useEffect(() => {
    fetchArticles();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <TopNav />

      <main className="container" style={{ paddingTop: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h1 className="title">Análisis Fundamental — Noticias</h1>
          <p className="sub">
            Módulo en tiempo real sin IA: solo lectura de noticias. Más adelante
            aquí añadiremos resúmenes y Masterclass con IA para Bitlog 3.0.
          </p>

          {/* Barra de búsqueda */}
          <form
            onSubmit={onSubmit}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar noticias por activo, empresa o palabra clave (ej. EURUSD, gold, BTC, Apple)..."
              style={{
                flex: 1,
                minWidth: 220,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              className="btn"
              style={{
                minWidth: 120,
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Buscar
            </button>
          </form>

          {/* Estado */}
          {loading && (
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 10 }}>
              Buscando noticias...
            </div>
          )}
          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#f97373",
                marginBottom: 10,
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          )}

          {/* Sin resultados */}
          {articles.length === 0 && !loading && !error && (
            <div
              style={{
                fontSize: 13,
                color: "#9ca3af",
                marginTop: 10,
              }}
            >
              No se encontraron noticias. Prueba con otra palabra clave.
            </div>
          )}

          {/* Grid de artículos */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 12,
            }}
          >
            {articles.map((a) => (
              <article
                key={a.url}
                className="card"
                style={{
                  padding: 12,
                  background: "#020617",
                  borderRadius: 12,
                  border: "1px solid #1f2937",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {a.imageUrl && (
                  <div
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      overflow: "hidden",
                      maxHeight: 160,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      style={{
                        width: "100%",
                        display: "block",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{a.source}</span>
                  {a.publishedAt && (
                    <span>{formatMazatlan(a.publishedAt)}</span>
                  )}
                </div>

                <h2
                  style={{
                    fontSize: 14,
                    margin: 0,
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {a.title}
                </h2>

                {a.description && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#d1d5db",
                      margin: "4px 0 0",
                    }}
                  >
                    {a.description}
                  </p>
                )}

               
               
      {/* dentro de tu map de artículos en /fundamental */}
<div
  style={{
    marginTop: "auto",
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
  }}
>
  {/* Vista limpia en NUEVA pestaña de Bitlog */}
 

  {/* Artículo original, como ya lo tienes */}
  <a
    href={a.url}
    target="_blank"
    rel="noreferrer"
    className="btn"
    style={{
      fontSize: 12,
      textDecoration: "none",
      textAlign: "center",
      borderRadius: 8,
      padding: "4px 10px",
      flex: 1,
    }}
  >
    Original
  </a>
</div>
    
          
          
          
          
          
          
          
        
               
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

