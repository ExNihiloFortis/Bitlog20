// app/fundamental/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";

type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
  description?: string;
  imageUrl?: string | null;
  content?: string;
};

type FilterMode = "all" | "market" | "macro" | "earnings" | "crypto" | "forex";

const quickSearches = ["AAPL", "TSLA", "NVDA", "SPY", "Gold", "BTC", "EURUSD", "Fed", "Earnings"];

const filters: { id: FilterMode; label: string; hint: string }[] = [
  { id: "all", label: "Todo", hint: "Noticias generales" },
  { id: "market", label: "Mercado", hint: "Acciones e índices" },
  { id: "macro", label: "Macro/Fed", hint: "Tasas, inflación, bancos centrales" },
  { id: "earnings", label: "Earnings", hint: "Reportes trimestrales" },
  { id: "crypto", label: "Cripto", hint: "BTC, ETH y mercado cripto" },
  { id: "forex", label: "Forex", hint: "Divisas principales" },
];

function formatMazatlan(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    hour12: true,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function articleText(article: Article) {
  return `${article.title || ""} ${article.description || ""} ${article.source || ""}`.toLowerCase();
}

function matchesFilter(article: Article, mode: FilterMode) {
  if (mode === "all") return true;
  const t = articleText(article);

  const dictionary: Record<Exclude<FilterMode, "all">, string[]> = {
    market: ["stock", "stocks", "market", "nasdaq", "dow", "s&p", "spy", "shares", "acciones"],
    macro: ["fed", "federal reserve", "inflation", "cpi", "rates", "yield", "powell", "treasury", "macro"],
    earnings: ["earnings", "eps", "revenue", "guidance", "quarter", "profit", "results"],
    crypto: ["bitcoin", "btc", "ethereum", "eth", "crypto", "cryptocurrency", "blockchain"],
    forex: ["forex", "eurusd", "gbpusd", "usdjpy", "usd", "euro", "yen", "currency", "currencies"],
  };

  return dictionary[mode].some((word) => t.includes(word));
}

function buildViewUrl(article: Article) {
  const params = new URLSearchParams();
  params.set("url", article.url || "");
  params.set("title", article.title || "Artículo fundamental");
  params.set("source", article.source || "");
  if (article.publishedAt) params.set("time", article.publishedAt);
  if (article.imageUrl) params.set("img", article.imageUrl);
  if (article.description) params.set("desc", article.description);
  if (article.content) params.set("content", article.content);
  return `/fundamental/view?${params.toString()}`;
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function FundamentalPage() {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("Noticias generales");
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchArticles(opts?: { q?: string }) {
    try {
      setLoading(true);
      setError(null);

      const q = opts?.q?.trim() || "";
      const params = new URLSearchParams();
      if (q) params.set("q", q);

      const res = await fetch(`/api/fundamental/news?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      setArticles(Array.isArray(data.articles) ? data.articles : []);
      setLastQuery(q || "Noticias generales");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al buscar noticias. Intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchArticles({ q: query });
  }

  function runQuickSearch(value: string) {
    setQuery(value);
    setActiveFilter("all");
    fetchArticles({ q: value });
  }

  useEffect(() => {
    fetchArticles();
  }, []);

  const filteredArticles = useMemo(
    () => articles.filter((article) => matchesFilter(article, activeFilter)),
    [articles, activeFilter]
  );

  const topSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      const name = article.source || sourceHost(article.url) || "Fuente";
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [articles]);

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb" }}>
      <TopNav />

      <main className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <section
          style={{
            border: "1px solid rgba(148, 163, 184, 0.18)",
            borderRadius: 24,
            padding: 22,
            background:
              "radial-gradient(circle at top left, rgba(37,99,235,.22), transparent 32%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #111827 100%)",
            boxShadow: "0 24px 80px rgba(0,0,0,.35)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(260px, .75fr)", gap: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>
                Fundamental Intelligence Center
              </div>
              <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: "10px 0 10px", fontWeight: 900 }}>
                Noticias fundamentales para operar con contexto, no con corazonadas.
              </h1>
              <p style={{ color: "#cbd5e1", maxWidth: 760, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                Busca noticias por activo, empresa, divisa o tema macro. Esta V1 mantiene el sistema ligero: lectura rápida, vista limpia en Bitlog y acceso al artículo original.
              </p>
            </div>

            <aside
              style={{
                border: "1px solid rgba(148, 163, 184, 0.18)",
                borderRadius: 18,
                padding: 16,
                background: "rgba(15, 23, 42, .72)",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Resumen actual</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Metric label="Noticias" value={String(articles.length)} />
                <Metric label="Filtro" value={String(filteredArticles.length)} />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>Búsqueda: {lastQuery}</div>
            </aside>
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: AAPL, EURUSD, gold, BTC, Fed, earnings..."
              style={{
                flex: 1,
                minWidth: 240,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(148, 163, 184, 0.28)",
                background: "rgba(2, 6, 23, .8)",
                color: "#e5e7eb",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button type="submit" className="btn" style={{ minWidth: 130, borderRadius: 14, fontWeight: 800 }}>
              Buscar
            </button>
          </form>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {quickSearches.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => runQuickSearch(item)}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  background: "rgba(15, 23, 42, .72)",
                  color: "#dbeafe",
                  borderRadius: 999,
                  padding: "7px 11px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 18, alignItems: "start" }}>
          <section>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {filters.map((filter) => {
                const active = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    title={filter.hint}
                    onClick={() => setActiveFilter(filter.id)}
                    style={{
                      border: active ? "1px solid #60a5fa" : "1px solid rgba(148, 163, 184, 0.18)",
                      background: active ? "rgba(37, 99, 235, .28)" : "rgba(15, 23, 42, .72)",
                      color: active ? "#bfdbfe" : "#cbd5e1",
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {loading && <SkeletonGrid />}

            {error && !loading && (
              <StateBox title="No se pudo cargar la información" text={error} tone="error" />
            )}

            {!loading && !error && filteredArticles.length === 0 && (
              <StateBox
                title="Sin noticias para este filtro"
                text="Prueba otra búsqueda o cambia el filtro. El mercado no siempre grita; a veces nomás carraspea."
              />
            )}

            {!loading && !error && filteredArticles.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {filteredArticles.map((article) => (
                  <ArticleCard key={article.url} article={article} />
                ))}
              </div>
            )}
          </section>

          <aside style={{ position: "sticky", top: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <SidePanel title="Fuentes principales">
              {topSources.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>Aún no hay fuentes cargadas.</p>
              ) : (
                topSources.map(([source, count]) => (
                  <div key={source} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "#cbd5e1", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source}</span>
                    <strong style={{ color: "#93c5fd" }}>{count}</strong>
                  </div>
                ))
              )}
            </SidePanel>

            <SidePanel title="Próximo upgrade lógico">
              <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                Después de esta V1: score de impacto, etiquetas por activo, calendario de earnings y resumen IA. Primero base sólida; luego cohetes.
              </p>
            </SidePanel>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 12, background: "rgba(2, 6, 23, .48)" }}>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const host = sourceHost(article.url);
  const viewUrl = buildViewUrl(article);

  return (
    <article
      style={{
        border: "1px solid rgba(148, 163, 184, 0.16)",
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96))",
        overflow: "hidden",
        minHeight: 360,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 18px 50px rgba(0,0,0,.22)",
      }}
    >
      <div style={{ height: 160, background: "#0f172a", overflow: "hidden" }}>
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.imageUrl} alt={article.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#475569", fontSize: 13, fontWeight: 800 }}>
            BITLOG FUNDAMENTAL
          </div>
        )}
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#94a3b8", fontSize: 11 }}>
          <span style={{ fontWeight: 800, color: "#bfdbfe", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.source || host || "Fuente"}</span>
          <span style={{ whiteSpace: "nowrap" }}>{formatMazatlan(article.publishedAt)}</span>
        </div>

        <h2 style={{ fontSize: 16, lineHeight: 1.3, margin: 0, color: "#f8fafc", fontWeight: 900 }}>{article.title}</h2>

        {article.description && (
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            {article.description.length > 180 ? `${article.description.slice(0, 180)}...` : article.description}
          </p>
        )}

        <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Link
            href={viewUrl}
            target="_blank"
            style={{
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 12,
              padding: "9px 10px",
              fontSize: 12,
              fontWeight: 900,
              color: "#020617",
              background: "#93c5fd",
            }}
          >
            Leer en Bitlog
          </Link>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            style={{
              textAlign: "center",
              textDecoration: "none",
              borderRadius: 12,
              padding: "9px 10px",
              fontSize: 12,
              fontWeight: 900,
              color: "#e5e7eb",
              border: "1px solid rgba(148,163,184,.22)",
              background: "rgba(15,23,42,.8)",
            }}
          >
            Original
          </a>
        </div>
      </div>
    </article>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(148, 163, 184, 0.16)", borderRadius: 18, background: "rgba(15, 23, 42, .78)", padding: 14 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#f8fafc", fontWeight: 900 }}>{title}</h3>
      {children}
    </div>
  );
}

function StateBox({ title, text, tone = "normal" }: { title: string; text: string; tone?: "normal" | "error" }) {
  return (
    <div style={{ border: `1px solid ${tone === "error" ? "rgba(248,113,113,.35)" : "rgba(148,163,184,.18)"}`, borderRadius: 18, padding: 18, background: tone === "error" ? "rgba(127,29,29,.20)" : "rgba(15,23,42,.72)" }}>
      <h3 style={{ margin: "0 0 6px", color: tone === "error" ? "#fecaca" : "#f8fafc", fontSize: 16 }}>{title}</h3>
      <p style={{ margin: 0, color: tone === "error" ? "#fecaca" : "#94a3b8", fontSize: 13, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} style={{ height: 360, borderRadius: 20, border: "1px solid rgba(148,163,184,.12)", background: "linear-gradient(90deg, rgba(15,23,42,.6), rgba(30,41,59,.7), rgba(15,23,42,.6))" }} />
      ))}
    </div>
  );
}
