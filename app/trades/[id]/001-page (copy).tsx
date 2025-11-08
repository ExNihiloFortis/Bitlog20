// ===================== [3] /trades/[id]/page.tsx =====================
// [3.1] Página de detalle:
//  - Muestra TODOS los campos disponibles del trade.
//  - Duración HH:MM:SS y badge WINNER/LOSER por $P&L.
//  - Botón Editar → /trades/[id]/edit
//  - Galería básica (si tienes trade_images) con signed URLs.
// =====================================================================

"use client";

import { createClient } from "@supabase/supabase-js";
import React, { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";

type Trade = {
  id: number;
  ticket: string;
  symbol: string | null;
  side: "BUY" | "SELL" | null;
  volume: number | null;
  entry_price: number | null;
  exit_price: number | null;
  dt_open_utc: string | null;
  dt_close_utc: string | null;
  ea: string | null;
  session: string | null;
  pnl_usd_gross: number | null;
  notes?: string | null;
};

type Img = { id: number; title: string | null; storage_path: string | null; external_url: string | null; signed?: string | null };

function fmtDuration(open?: string | null, close?: string | null) {
  if (!open || !close) return "";
  const ms = new Date(close).getTime() - new Date(open).getTime();
  if (ms <= 0) return "";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n:number)=> String(n).padStart(2,"0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TradeDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [sb] = useState(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
  const [trade, setTrade] = useState<Trade | null>(null);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await sb
          .from("trades")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        setTrade(data as any);

        // cargar imágenes
        const ti = await sb.from("trade_images").select("id,title,storage_path,external_url").eq("trade_id", id).order("sort_index", { ascending: true });
        const rows = (ti.data ?? []) as Img[];
        for (const r of rows) {
          if (r.storage_path) {
            const su = await sb.storage.from("journal").createSignedUrl(r.storage_path, 3600);
            r.signed = su.data?.signedUrl ?? null;
          }
        }
        setImgs(rows);
      } catch (e: any) {
        setErr(String(e));
      }
    })();
  }, [id, sb]);

  const duration = useMemo(() => fmtDuration(trade?.dt_open_utc, trade?.dt_close_utc), [trade]);
  const win = (trade?.pnl_usd_gross ?? 0) >= 0;

  if (err) {
    return (
      <>
        <TopNav />
        <div className="container"><div className="card" style={{padding:16}}>Error: {err}</div></div>
      </>
    );
  }

  if (!trade) {
    return (
      <>
        <TopNav />
        <div className="container"><div className="card" style={{padding:16}}>Cargando…</div></div>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card" style={{ padding: 16 }}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <h2 className="title">Trade #{trade.ticket}</h2>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span className={`badge ${win ? "pnl-pos" : "pnl-neg"}`}>{win ? "WINNER" : "LOSER"}</span>
              <a className="btn" href={`/trades/${id}/edit`}>Editar</a>
            </div>
          </div>

          <div className="grid-3" style={{marginTop:12}}>
            <div><b>Símbolo:</b> {trade.symbol ?? "-"}</div>
            <div><b>Lado:</b> {trade.side ?? "-"}</div>
            <div><b>Volumen:</b> {trade.volume ?? "-"}</div>

            <div><b>Entry:</b> {trade.entry_price ?? "-"}</div>
            <div><b>Exit:</b> {trade.exit_price ?? "-"}</div>
            <div><b>$ P&L:</b> {trade.pnl_usd_gross ?? "-"}</div>

            <div><b>Apertura (UTC):</b> {trade.dt_open_utc ?? "-"}</div>
            <div><b>Cierre (UTC):</b> {trade.dt_close_utc ?? "-"}</div>
            <div><b>Duración:</b> {duration || "-"}</div>

            <div><b>EA:</b> {trade.ea ?? "-"}</div>
            <div><b>Sesión:</b> {trade.session ?? "-"}</div>
            <div><b>Notas:</b> {trade.notes ?? "-"}</div>
          </div>

          {imgs.length > 0 && (
            <>
              <h3 style={{marginTop:16}}>Galería</h3>
              <div className="img-grid">
                {imgs.map(im=>(
                  <div key={im.id} className="img-card">
                    <img src={im.signed ?? im.external_url ?? ""} alt={im.title ?? ""} />
                    <div className="img-meta">{im.title}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

