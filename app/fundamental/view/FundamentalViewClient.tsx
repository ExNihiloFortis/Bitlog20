// app/fundamental/view/FundamentalViewClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ReaderArticle = {
  ok: boolean;
  title?: string;
  byline?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  content?: string;
  textContent?: string;
  length?: number;
  error?: string;
};

function formatMazatlan(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    hour12: true,
    dateStyle: "full",
    timeStyle: "short",
  });
}

function splitIntoParagraphs(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const parts = clean.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/);
  const paragraphs: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const sentence = part.trim();
    if (!sentence) continue;
    buffer = buffer ? `${buffer} ${sentence}` : sentence;

    if (buffer.length > 320) {
      paragraphs.push(buffer);
      buffer = "";
    }
  }

  if (buffer) paragraphs.push(buffer);
  return paragraphs.length > 0 ? paragraphs : [clean];
}

function getHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function FundamentalViewClient() {
  const searchParams = useSearchParams();

  const url = searchParams.get("url") || "";
  const fallbackTitle = searchParams.get("title") || "Artículo fundamental";
  const source = searchParams.get("source") || "";
  const time = searchParams.get("time");
  const img = searchParams.get("img");
  const desc = searchParams.get("desc") || "";
  const rawContent = searchParams.get("content") || desc;
  const host = getHost(url);

  const [reader, setReader] = useState<ReaderArticle | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    let cancelled = false;

    async function loadReader() {
      if (!url) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/readability?url=${encodeURIComponent(url)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await res.json()) as ReaderArticle;
        if (!cancelled) setReader(data);
      } catch {
        if (!cancelled) setReader({ ok: false, error: "No se pudo cargar el modo lectura." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReader();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const title = reader?.ok && reader.title ? reader.title : fallbackTitle;
  const lead = reader?.ok && reader.excerpt ? reader.excerpt : desc;
  const byline = reader?.ok ? reader.byline : null;
  const siteName = reader?.ok ? reader.siteName : null;

  const fallbackParagraphs = useMemo(() => splitIntoParagraphs(rawContent), [rawContent]);

  return (
    <article style={{ maxWidth: 980, margin: "0 auto", color: "#e5e7eb" }}>
      <div
        style={{
          border: "1px solid rgba(148,163,184,.18)",
          borderRadius: 24,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(15,23,42,.98), rgba(2,6,23,.98))",
          boxShadow: "0 24px 80px rgba(0,0,0,.35)",
        }}
      >
        {img && (
          <div style={{ height: 340, overflow: "hidden", background: "#0f172a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        )}

        <div style={{ padding: 24 }}>
          <Link href="/fundamental" style={{ color: "#93c5fd", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
            ← Volver a noticias
          </Link>

          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8, color: "#94a3b8", fontSize: 12 }}>
            {source && <Badge>{source}</Badge>}
            {(siteName || host) && <Badge>{siteName || host}</Badge>}
            {time && <Badge>{formatMazatlan(time)}</Badge>}
            {reader?.ok && <Badge>Modo lectura</Badge>}
          </div>

          <h1 style={{ margin: "16px 0 12px", fontSize: 34, lineHeight: 1.12, color: "#f8fafc", fontWeight: 950 }}>
            {title}
          </h1>

          {byline && <p style={{ margin: "0 0 10px", color: "#93c5fd", fontSize: 13, fontWeight: 800 }}>Por {byline}</p>}

          {lead && (
            <p style={{ margin: "0 0 22px", color: "#bfdbfe", fontSize: 16, lineHeight: 1.65, fontWeight: 650 }}>
              {lead}
            </p>
          )}

          <div style={{ borderTop: "1px solid rgba(148,163,184,.14)", paddingTop: 20 }}>
            {loading && <ReaderSkeleton />}

            {!loading && reader?.ok && reader.content && (
              <div className="bitlog-reader-content" dangerouslySetInnerHTML={{ __html: reader.content }} />
            )}

            {!loading && (!reader?.ok || !reader.content) && (
              <div>
                <Notice
                  title="Modo lectura limitado"
                  text={reader?.error || "Este sitio no entregó el artículo completo. Te muestro la información disponible y el enlace original."}
                />

                {fallbackParagraphs.length > 0 ? (
                  <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14, fontSize: 15, color: "#dbeafe", lineHeight: 1.78 }}>
                    {fallbackParagraphs.map((paragraph, idx) => (
                      <p key={idx} style={{ margin: 0 }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p style={{ marginTop: 18, color: "#94a3b8", fontSize: 14 }}>
                    No hay descripción disponible para esta noticia. Abre el artículo original para leerlo completo.
                  </p>
                )}
              </div>
            )}
          </div>

          {url && (
            <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  textAlign: "center",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#020617",
                  background: "#93c5fd",
                }}
              >
                Abrir artículo original
              </a>
              <Link
                href="/fundamental"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  textAlign: "center",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#e5e7eb",
                  border: "1px solid rgba(148,163,184,.22)",
                  background: "rgba(15,23,42,.8)",
                }}
              >
                Buscar más noticias
              </Link>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .bitlog-reader-content {
          color: #dbeafe;
          font-size: 16px;
          line-height: 1.85;
        }
        .bitlog-reader-content p {
          margin: 0 0 18px;
        }
        .bitlog-reader-content h1,
        .bitlog-reader-content h2,
        .bitlog-reader-content h3 {
          color: #f8fafc;
          line-height: 1.25;
          margin: 28px 0 12px;
        }
        .bitlog-reader-content a {
          color: #93c5fd;
          text-decoration: none;
          font-weight: 800;
        }
        .bitlog-reader-content img,
        .bitlog-reader-content video {
          max-width: 100%;
          height: auto;
          border-radius: 16px;
          margin: 16px 0;
        }
        .bitlog-reader-content blockquote {
          margin: 18px 0;
          padding: 14px 16px;
          border-left: 3px solid #60a5fa;
          background: rgba(15, 23, 42, 0.72);
          border-radius: 12px;
          color: #bfdbfe;
        }
        .bitlog-reader-content ul,
        .bitlog-reader-content ol {
          padding-left: 22px;
          margin: 14px 0 18px;
        }
        .bitlog-reader-content li {
          margin: 8px 0;
        }
      `}</style>
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(15,23,42,.72)", borderRadius: 999, padding: "6px 10px" }}>
      {children}
    </span>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ border: "1px solid rgba(251,191,36,.24)", borderRadius: 16, padding: 14, background: "rgba(120,53,15,.18)", color: "#fde68a" }}>
      <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
      <span style={{ color: "#fef3c7", fontSize: 13, lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 900 }}>Descargando artículo en modo lectura...</div>
      {["92%", "100%", "88%", "96%", "74%"].map((width) => (
        <div key={width} style={{ height: 14, width, borderRadius: 999, background: "linear-gradient(90deg, rgba(15,23,42,.7), rgba(51,65,85,.8), rgba(15,23,42,.7))" }} />
      ))}
    </div>
  );
}
