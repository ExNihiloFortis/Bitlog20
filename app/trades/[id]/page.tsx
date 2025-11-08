// ===================== [/trades/[id]/page.tsx] =====================
// Clon de /trades/new en modo lectura. Encabezado con Ticket.
// ==================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";

type Opt = { id?: number; label: string };
const SESSIONS = ["Asia", "London", "NY", "After-hours"] as const;
const DEFAULT_TFS = ["M5", "M15", "H1", "H4", "D1"];

export default function ShowTradePage() {
  const { id } = useParams<{ id: string }>();
  const tradeId = Number(id);

  const [userId, setUserId] = useState("");
  const [symbols, setSymbols] = useState<Opt[]>([]);
  const [timeframes, setTimeframes] = useState<Opt[]>([]);
  const [eas, setEas] = useState<Opt[]>([]);
  const [patterns, setPatterns] = useState<Opt[]>([]);
  const [candles, setCandles] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    ticket: "",
    session: "London" as (typeof SESSIONS)[number],
    symbol: "",
    timeframe: "",
    ea: "",
    patron: "",
    vela: "",
    tendencia: "",
    pips: "",
    rr_objetivo: "",
    pnl_usd_gross: "",
    notas: "",
  });

  const disabled = useMemo(() => true, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      setUserId(auth.user?.id ?? "");

      const { data: trade } = await supabase
        .from("trades")
        .select("ticket,session,symbol,timeframe,ea,patron,vela,tendencia,pips,rr_objective,pnl_usd_gross,notes")
        .eq("id", tradeId)
        .single();

      setForm({
        ticket: trade?.ticket ?? "",
        session: trade?.session ?? "London",
        symbol: trade?.symbol ?? "",
        timeframe: trade?.timeframe ?? DEFAULT_TFS[0],
        ea: trade?.ea ?? "",
        patron: trade?.patron ?? "",
        vela: trade?.vela ?? "",
        tendencia: trade?.tendencia ?? "",
        pips: trade?.pips ?? "",
        rr_objetivo: trade?.rr_objective ?? "",
        pnl_usd_gross: trade?.pnl_usd_gross ?? "",
        notas: trade?.notes ?? "",
      });

      setLoading(false);
    })();
  }, [tradeId]);

  return (
    <div className="page-center">
      <div className="form-card">
        <div className="form-head">
          <div className="form-title">Trade (Ticket #{form.ticket || "—"})</div>
          <span className="badge">/trades/{tradeId}</span>
        </div>

        <div className="form-body">
          {/* Misma cuadrícula, sólo disabled */}
          <div className="grid-3">
            <div className="field">
              <label className="label">Ticket</label>
              <input className="input" value={form.ticket} disabled />
            </div>
            <div className="field">
              <label className="label">Símbolo</label>
              <input className="input" value={form.symbol} disabled />
            </div>
            <div className="field">
              <label className="label">Timeframe</label>
              <input className="input" value={form.timeframe} disabled />
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Sesión</label>
              <input className="input" value={form.session} disabled />
            </div>
            <div className="field">
              <label className="label">EA</label>
              <input className="input" value={form.ea} disabled />
            </div>
            <div className="field">
              <label className="label">Patrón</label>
              <input className="input" value={form.patron} disabled />
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Vela</label>
              <input className="input" value={form.vela} disabled />
            </div>
            <div className="field">
              <label className="label">Tendencia</label>
              <input className="input" value={form.tendencia} disabled />
            </div>
            <div className="field">
              <label className="label">$ P&L (USD)</label>
              <input className="input" value={form.pnl_usd_gross} disabled />
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Pips</label>
              <input className="input" value={form.pips} disabled />
            </div>
            <div className="field">
              <label className="label">R objetivo</label>
              <input className="input" value={form.rr_objetivo} disabled />
            </div>
            <div className="field">
              <label className="label">Notas</label>
              <textarea className="textarea" value={form.notas} disabled />
            </div>
          </div>

          <div className="btn-row">
            <a className="btn" href={`/trades/${tradeId}/edit`}>Editar</a>
            <a className="btn secondary" href="/trades">Volver</a>
          </div>
        </div>

        <div style={{ marginTop: 18, marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>Galería</div>
          <ImageManager tradeId={tradeId} userId={userId} readOnly />
        </div>
      </div>
    </div>
  );
}

