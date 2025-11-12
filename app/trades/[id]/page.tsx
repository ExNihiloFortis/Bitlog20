"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";

/* =========================
   HELPERS UI
   ========================= */
function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: any;
  strong?: boolean;
}) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="value" style={strong ? { fontWeight: 600 } : undefined}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function fmtNum(n: any) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return String(n);
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(v);
}

function fmtMazatlanLoose(raw: string | null) {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    return d.toLocaleString("es-MX", {
      timeZone: "America/Mazatlan",
      hour12: true,
    });
  } catch {
    return raw || "—";
  }
}

// === [PATCH-DUR-HELPERS] ===
function toDateSafe(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function formatDuration(ms: number) {
  if (!isFinite(ms) || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* =========================
   TOP NAV
   ========================= */
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

/* =========================
   PÁGINA SHOW
   ========================= */
export default function TradeShowPage() {
  const params = useParams<{ id: string }>();
  const [uid, setUid] = useState<string>("");
  const [t, setT] = useState<any>(null);
  const [prevId, setPrevId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);

  // Cargar trade + vecinos
  useEffect(() => {
    async function loadTrade() {
      const { data: auth } = await supabase.auth.getUser();
      setUid(auth.user?.id ?? "");

      const { data, error } = await supabase
        .from("trades")
        .select(
          `
          id, user_id,
          ticket,
          symbol, timeframe, side, session,
          entry_price, exit_price, volume, pnl_usd_gross,
          patron, vela, pips, rr_objetivo, tendencia, emocion,
          ea, ea_signal, ea_tp1, ea_tp2, ea_tp3, ea_sl1, ea_score,
          dt_open_utc, dt_close_utc,
          close_reason, swap, equity_usd, margin_level, notes, created_at
        `
        )
        .eq("id", Number(params.id))
        .maybeSingle();

      if (error) {
        alert("Error cargando trade: " + error.message);
        return;
      }

      setT(data);

      // Vecinos por fecha de apertura
      const ot = data?.dt_open_utc;
      if (ot) {
        const { data: prev } = await supabase
          .from("trades")
          .select("id, dt_open_utc")
          .lt("dt_open_utc", ot)
          .order("dt_open_utc", { ascending: false })
          .limit(1);

        const { data: next } = await supabase
          .from("trades")
          .select("id, dt_open_utc")
          .gt("dt_open_utc", ot)
          .order("dt_open_utc", { ascending: true })
          .limit(1);

        setPrevId(prev?.[0]?.id ?? null);
        setNextId(next?.[0]?.id ?? null);
      } else {
        setPrevId(null);
        setNextId(null);
      }
    }

    loadTrade();
  }, [params.id]);

  // Winner/Loser
  const isWinner = useMemo(() => (t?.pnl_usd_gross ?? 0) >= 0, [t]);

  // === [PATCH-DUR-STATE] ===
  const durationStr = useMemo(() => {
    const open = t?.dt_open_utc ?? t?.opening_time_utc ?? null;
    const close = t?.dt_close_utc ?? t?.closing_time_utc ?? null;
    const d1 = toDateSafe(open);
    const d2 = toDateSafe(close);
    if (!d1 || !d2) return "—";
    return formatDuration(d2.getTime() - d1.getTime());
  }, [t]);

  if (!t) {
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
    <div className="container">
      <TopNav />

      <div className="card">
        {/* ENCABEZADO */}
        <div
          className="head-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <h1 className="title">
              Trade #{t.ticket ?? t.id} /{" "}
              <span style={{ opacity: 0.85 }}>Bitlog ID: #{t.id}</span>
            </h1>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: isWinner ? "#0a4" : "#a00",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {isWinner ? "WINNER" : "LOSER"}
            </span>
            <a className="btn" href={`/trades/${t.id}/edit`}>
              Editar
            </a>
          </div>
        </div>

        {/* DOS COLUMNAS */}
        <div
          className="two-cols"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* COLUMNA IZQ */}
          <div className="col">
            <Field label="Símbolo" value={t.symbol} />
            <Field label="Timeframe" value={t.timeframe} />
            <Field label="Lado" value={t.side} />
            <Field label="Sesión" value={t.session} />
            <Field label="Precio de Apertura" value={fmtNum(t.entry_price)} />
            <Field label="Precio de Cierre" value={fmtNum(t.exit_price)} />
            <Field label="Volumen" value={fmtNum(t.volume)} />
            <Field label="$P&L" value={fmtNum(t.pnl_usd_gross)} strong />
            <Field label="Patrón" value={t.patron} />
            <Field label="Vela" value={t.vela} />
            <Field label="Pips" value={fmtNum(t.pips)} />
            <Field label="R objetivo" value={t.rr_objetivo} />
            <Field label="Tendencia" value={t.tendencia} />
            <Field label="Emoción" value={t.emocion} />
          </div>

          {/* COLUMNA DER */}
          <div className="col">
            <Field label="EA" value={t.ea} />
            <Field label="Señal (EA)" value={t.ea_signal} />
            <Field label="Calificación (EA)" value={fmtNum(t.ea_score)} />
            <Field label="TP1" value={t.ea_tp1} />
            <Field label="TP2" value={t.ea_tp2} />
            <Field label="TP3" value={t.ea_tp3} />
            <Field label="SL1" value={t.ea_sl1} />

            {/* Fechas + Duración */}
            <Field label="Apertura (UTC-7)" value={fmtMazatlanLoose(t.dt_open_utc)} />
            <Field label="Cierre (UTC-7)" value={fmtMazatlanLoose(t.dt_close_utc)} />
            {/* [PATCH-DUR-FIELD] */}
            <Field label="Duración" value={durationStr} />

            <Field label="Swap" value={fmtNum(t.swap)} />
            <Field label="Equity (USD)" value={fmtNum(t.equity_usd)} />
            <Field label="Margin Level" value={fmtNum(t.margin_level)} />
            <Field label="Close Reason" value={t.close_reason ?? "—"} />
          </div>
        </div>

        {/* NOTAS */}
        <div style={{ marginTop: 16 }}>
          <label className="label">Notas</label>
          <div className="textarea" style={{ minHeight: 80 }}>
            {t.notes || "—"}
          </div>
        </div>

        {/* IMÁGENES */}
        <div style={{ marginTop: 16 }}>
          <label className="label">Imágenes</label>
          <ImageManager tradeId={t.id} userId={uid} readOnly />
        </div>

        {/* BOTONES PIE */}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <a className="btn secondary" href="/trades">
            Volver
          </a>
          <a className="btn" href={`/trades/${t.id}/edit`}>
            Editar
          </a>
          {prevId && (
            <a className="btn secondary" href={`/trades/${prevId}`}>
              Anterior
            </a>
          )}
          {nextId && (
            <a className="btn secondary" href={`/trades/${nextId}`}>
              Siguiente
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

