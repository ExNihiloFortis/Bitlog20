"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

// Formato Mazatlán (UTC-7)
function formatMazatlan(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    hour12: true,
  });
}

// Rompe un texto largo en párrafos más legibles
function splitIntoParagraphs(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();

  const parts = clean.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ0-9])/);
  const paras: string[] = [];

  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    paras.push(t);
  }

  return paras.length > 0 ? paras : [clean];
}

export default function FundamentalViewClient() {
  const searchParams = useSearchParams();

  const url = searchParams.get("url") || "";
  const title = searchParams.get("title") || "Article";
  const source = searchParams.get("source") || "";
  const time = searchParams.get("time");
  const img = searchParams.get("img");
  const desc = searchParams.get("desc") || "";

  const rawContent = searchParams.get("content") || desc;
  const paragraphs = splitIntoParagraphs(rawContent);

  let host: string | null = null;
  try {
    if (url) {
      host = new URL(url).hostname.replace(/^www\./, "");
    }
  } catch {
    host = null;
  }

  return (
    <div
      className="card"
      style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}
    >
      <h1 className="title" style={{ marginBottom: 8 }}>
        {title}
      </h1>

      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {source && <span>{source}</span>}
        {host && <span>{host}</span>}
        {time && <span>{formatMazatlan(time)}</span>}
      </div>

      {img && (
        <div
          style={{
            width: "100%",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={title}
            style={{
              width: "100%",
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      {paragraphs.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 14,
            color: "#e5e7eb",
            lineHeight: 1.6,
          }}
        >
          {paragraphs.map((p, idx) => (
            <p key={idx} style={{ margin: 0 }}>
              {p}
            </p>
          ))}
        </div>
      )}

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="btn"
          style={{
            marginTop: 20,
            fontSize: 13,
            textDecoration: "none",
            textAlign: "center",
            borderRadius: 8,
            display: "inline-block",
            padding: "6px 14px",
          }}
        >
          Abrir artículo original
        </a>
      )}
    </div>
  );
}

