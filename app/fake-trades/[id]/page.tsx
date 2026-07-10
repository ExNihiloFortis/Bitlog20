"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/components/TopNav";
import FakeTradeImageManager from "@/components/FakeTradeImageManager";

function Field({ label, value, strong = false }: { label: string; value: any; strong?: boolean }) {
  return <div className="field"><div className="label">{label}</div><div className={strong ? "value value-strong" : "value"}>{value ?? "—"}</div></div>;
}
function fmtNum(n: any) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return String(n);
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(v);
}
function fmtDT(raw: string | null) {
  if (!raw) return "—";
  try { return new Date(raw).toLocaleString("es-MX", { timeZone: "America/Mazatlan", hour12: true }); }
  catch { return raw; }
}
function resultLabel(r: string | null) {
  if (r === "WIN") return "SE CUMPLIÓ";
  if (r === "LOSS") return "NO SE CUMPLIÓ";
  if (r === "NEUTRAL") return "NEUTRAL";
  return "PENDIENTE";
}
function resultColor(r: string | null) {
  if (r === "WIN") return "#0a4";
  if (r === "LOSS") return "#a00";
  if (r === "NEUTRAL") return "#555";
  return "#92400e";
}

export default function FakeTradeShowPage() {
  const params = useParams<{ id: string }>();
  const [uid, setUid] = useState("");
  const [t, setT] = useState<any>(null);
  const [prevId, setPrevId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      setUid(auth.user?.id ?? "");
      const id = Number(params.id);
      const { data, error } = await supabase.from("fake_trades").select("*").eq("id", id).maybeSingle();
      if (error) { alert("Error cargando fake trade: " + error.message); return; }
      setT(data);
      const { data: prev } = await supabase.from("fake_trades").select("id").lt("id", id).order("id", { ascending: false }).limit(1);
      const { data: next } = await supabase.from("fake_trades").select("id").gt("id", id).order("id", { ascending: true }).limit(1);
      setPrevId(prev?.[0]?.id ?? null);
      setNextId(next?.[0]?.id ?? null);
    }
    load();
  }, [params.id]);

  const badge = useMemo(() => (
    <span style={{ padding: "4px 10px", borderRadius: 999, background: resultColor(t?.result), color: "#fff", fontWeight: 700 }}>{resultLabel(t?.result)}</span>
  ), [t?.result]);

  if (!t) return <><TopNav /><div className="container"><div className="card"><p>Cargando…</p></div></div></>;

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card">
          <div className="head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h1 className="title">Fake Trade #{t.id} / {t.symbol}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {badge}
              <a className="btn" href={`/fake-trades/${t.id}/edit`}>Editar</a>
            </div>
          </div>

          <div className="two-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="col">
              <Field label="Símbolo" value={t.symbol} />
              <Field label="Lado" value={t.side} />
              <Field label="Timeframe" value={t.timeframe} />
              <Field label="Fecha / hora señal" value={fmtDT(t.setup_datetime)} />
              <Field label="Fecha objetivo" value={fmtDT(t.target_date)} />
              <Field label="Origen" value={t.source_type === "EXTERNA" ? "Señal externa" : "Decisión propia"} />
              <Field label="Fuente" value={t.source_name} />
              <Field label="URL" value={t.source_url ? <a className="link" href={t.source_url} target="_blank" rel="noreferrer">Abrir fuente</a> : "—"} />
              <Field label="Patrón" value={t.pattern_name} />
              <Field label="Vela" value={t.candle_name} />
              <Field label="EA / IA / Modelo" value={t.ea} />
            </div>
            <div className="col">
              <Field label="Entrada" value={fmtNum(t.entry_price)} />
              <Field label="Stop Loss" value={fmtNum(t.stop_loss)} />
              <Field label="TP1" value={fmtNum(t.tp1 ?? t.take_profit)} />
              <Field label="TP2" value={fmtNum(t.tp2)} />
              <Field label="Resistencia" value={fmtNum(t.resistance)} />
              <Field label="Pivote" value={fmtNum(t.pivot)} />
              <Field label="Soporte" value={fmtNum(t.support)} />
              <Field label="Tendencia" value={t.tendencia} />
              <Field label="Sesión" value={t.session} />
              <Field label="Resultado" value={resultLabel(t.result)} strong />
              <Field label="Creado" value={fmtDT(t.created_at)} />
            </div>
          </div>

          <div className="grid-3" style={{ marginTop: 16 }}>
            <Field label="RSI" value={fmtNum(t.rsi_value)} />
            <Field label="Estocástico K%" value={fmtNum(t.stochastic_k)} />
            <Field label="Estocástico D%" value={fmtNum(t.stochastic_d)} />
            <Field label="EMA20" value={fmtNum(t.ema20)} />
            <Field label="EMA50" value={fmtNum(t.ema50)} />
            <Field label="EMA100" value={fmtNum(t.ema100)} />
            <Field label="EMA200" value={fmtNum(t.ema200)} />
            <Field label="ATR" value={fmtNum(t.atr)} />
            <Field label="ADX" value={fmtNum(t.adx)} />
            <Field label="RVOL" value={fmtNum(t.rvol)} />
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="label">Qué esperaba</label>
            <div className="textarea" style={{ minHeight: 52, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.expected_move || "—"}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="label">Motivo del fallo</label>
            <div className="textarea" style={{ minHeight: 52, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.failure_reason || "—"}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="label">Lecciones aprendidas</label>
            <div className="textarea" style={{ minHeight: 72, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.lessons_learned || "—"}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="label">Notas</label>
            <div className="textarea" style={{ minHeight: 80, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.notes || "—"}</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="label">Captura del patrón / imágenes</label>
            <FakeTradeImageManager fakeTradeId={t.id} userId={uid} readOnly />
          </div>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <a className="btn secondary" href="/fake-trades">Volver</a>
            <a className="btn" href={`/fake-trades/${t.id}/edit`}>Editar</a>
            {prevId && <a className="btn secondary" href={`/fake-trades/${prevId}`}>Anterior</a>}
            {nextId && <a className="btn secondary" href={`/fake-trades/${nextId}`}>Siguiente</a>}
          </div>
        </div>
      </div>
    </>
  );
}
