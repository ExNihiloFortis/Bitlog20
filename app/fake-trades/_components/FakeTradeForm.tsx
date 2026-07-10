"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opt = { id?: number; label: string };
type Mode = "create" | "edit";

const SESSIONS = ["Sydney", "Tokyo", "London", "New York", "After-Hours"] as const;

export type FakeTradeFormValues = {
  symbol: string;
  side: "" | "BUY" | "SELL";
  result: "PENDING" | "WIN" | "LOSS" | "NEUTRAL";
  timeframe: string;
  setup_datetime: string;
  target_date: string;

  source_type: "PROPIA" | "EXTERNA";
  source_name: string;
  source_url: string;
  pattern_name: string;
  candle_name: string;
  ea: string;

  entry_price: string;
  stop_loss: string;
  tp1: string;
  tp2: string;
  resistance: string;
  pivot: string;
  support: string;

  tendencia: string;
  session: string;
  rsi_value: string;
  stochastic_k: string;
  stochastic_d: string;
  ema20: string;
  ema50: string;
  ema100: string;
  ema200: string;
  atr: string;
  adx: string;
  rvol: string;

  expected_move: string;
  failure_reason: string;
  lessons_learned: string;
  notes: string;
};

type Props = {
  mode: Mode;
  initialValues: Partial<FakeTradeFormValues>;
  saving?: boolean;
  disabled?: boolean;
  onSubmit: (values: FakeTradeFormValues) => Promise<void> | void;
};

async function loadOptions(type: string): Promise<Opt[]> {
  const { data } = await supabase
    .from("catalog_items")
    .select("id,value,sort_index")
    .eq("type", type)
    .order("sort_index", { ascending: true })
    .order("value", { ascending: true });

  if (data?.length) {
    return data
      .map((d: any) => ({ id: d.id, label: d.value as string }))
      .sort((a: Opt, b: Opt) => a.label.localeCompare(b.label));
  }

  if (type === "symbol") {
    const { data: ds } = await supabase
      .from("distinct_symbols")
      .select("symbol")
      .order("symbol");
    return (ds || [])
      .map((r: any) => ({ label: r.symbol as string }))
      .sort((a: Opt, b: Opt) => a.label.localeCompare(b.label));
  }

  return [];
}

const INITIAL_NOTES = `Objetivo del fake trade:
Medir si la predicción externa se cumple, no si yo tuve razón.

Resumen de la predicción:

Condición de entrada propuesta:

Condición para considerar cumplida la idea:

Qué invalidaría la predicción:

Observaciones:
`;

export default function FakeTradeForm({
  mode,
  initialValues,
  saving = false,
  disabled = false,
  onSubmit,
}: Props) {
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [symbols, setSymbols] = useState<Opt[]>([]);
  const [timeframes, setTimeframes] = useState<Opt[]>([]);
  const [patterns, setPatterns] = useState<Opt[]>([]);
  const [candles, setCandles] = useState<Opt[]>([]);
  const [eas, setEas] = useState<Opt[]>([]);
  const [sources, setSources] = useState<Opt[]>([]);

  const [form, setForm] = useState<FakeTradeFormValues>({
    symbol: initialValues.symbol ?? "",
    side: initialValues.side ?? "",
    result: initialValues.result ?? "PENDING",
    timeframe: initialValues.timeframe ?? "",
    setup_datetime: initialValues.setup_datetime ?? "",
    target_date: initialValues.target_date ?? "",

    source_type: initialValues.source_type ?? "EXTERNA",
    source_name: initialValues.source_name ?? "",
    source_url: initialValues.source_url ?? "",
    pattern_name: initialValues.pattern_name ?? "",
    candle_name: initialValues.candle_name ?? "",
    ea: initialValues.ea ?? "",

    entry_price: initialValues.entry_price ?? "",
    stop_loss: initialValues.stop_loss ?? "",
    tp1: initialValues.tp1 ?? "",
    tp2: initialValues.tp2 ?? "",
    resistance: initialValues.resistance ?? "",
    pivot: initialValues.pivot ?? "",
    support: initialValues.support ?? "",

    tendencia: initialValues.tendencia ?? "",
    session: initialValues.session ?? "",
    rsi_value: initialValues.rsi_value ?? "",
    stochastic_k: initialValues.stochastic_k ?? "",
    stochastic_d: initialValues.stochastic_d ?? "",
    ema20: initialValues.ema20 ?? "",
    ema50: initialValues.ema50 ?? "",
    ema100: initialValues.ema100 ?? "",
    ema200: initialValues.ema200 ?? "",
    atr: initialValues.atr ?? "",
    adx: initialValues.adx ?? "",
    rvol: initialValues.rvol ?? "",

    expected_move: initialValues.expected_move ?? "",
    failure_reason: initialValues.failure_reason ?? "",
    lessons_learned: initialValues.lessons_learned ?? "",
    notes: initialValues.notes ?? INITIAL_NOTES,
  });

  useEffect(() => {
    setForm((p) => ({ ...p, ...initialValues } as FakeTradeFormValues));
  }, [initialValues]);

  useEffect(() => {
    (async () => {
      const [sym, tf, pat, vel, eaOpts, sourceOpts] = await Promise.all([
        loadOptions("symbol"),
        loadOptions("timeframe"),
        loadOptions("pattern"),
        loadOptions("candle"),
        loadOptions("ea"),
        loadOptions("fake_source"),
      ]);
      setSymbols(sym);
      setTimeframes(tf);
      setPatterns(pat);
      setCandles(vel);
      setEas(eaOpts);
      setSources(sourceOpts);
    })();
  }, []);

  function set<K extends keyof FakeTradeFormValues>(key: K, value: FakeTradeFormValues[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || saving) return;
    await onSubmit(form);
  }

  const isLocked = disabled || saving;

  return (
    <form onSubmit={submit}>
      <div className="grid-3">
        <div className="field">
          <label className="label">Símbolo *</label>
          <select className="select" value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {symbols.map((s) => <option key={s.id ?? s.label} value={s.label}>{s.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Lado</label>
          <select className="select" value={form.side} onChange={(e) => set("side", e.target.value as any)} disabled={isLocked}>
            <option value="">—</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Resultado</label>
          <select className="select" value={form.result} onChange={(e) => set("result", e.target.value as any)} disabled={isLocked}>
            <option value="PENDING">Pendiente</option>
            <option value="WIN">Se cumplió</option>
            <option value="LOSS">No se cumplió</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Timeframe</label>
          <select className="select" value={form.timeframe} onChange={(e) => set("timeframe", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {timeframes.map((t) => <option key={t.id ?? t.label} value={t.label}>{t.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Fecha / hora de señal</label>
          <input type="datetime-local" className="input" value={form.setup_datetime} onChange={(e) => set("setup_datetime", e.target.value)} disabled={isLocked} />
        </div>

        <div className="field">
          <label className="label">Fecha objetivo</label>
          <input type="datetime-local" className="input" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} disabled={isLocked} />
        </div>

        <div className="field">
          <label className="label">Origen</label>
          <select className="select" value={form.source_type} onChange={(e) => set("source_type", e.target.value as any)} disabled={isLocked}>
            <option value="EXTERNA">Señal / alerta externa</option>
            <option value="PROPIA">Decisión propia</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Sitio / fuente</label>
          <select className="select" value={form.source_name} onChange={(e) => set("source_name", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {sources.map((s) => <option key={s.id ?? s.label} value={s.label}>{s.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">URL de la señal</label>
          <input className="input" value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://..." disabled={isLocked} />
        </div>

        <div className="field">
          <label className="label">Patrón</label>
          <select className="select" value={form.pattern_name} onChange={(e) => set("pattern_name", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {patterns.map((p) => <option key={p.id ?? p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">Vela</label>
          <select className="select" value={form.candle_name} onChange={(e) => set("candle_name", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {candles.map((c) => <option key={c.id ?? c.label} value={c.label}>{c.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="label">EA / IA / Modelo</label>
          <select className="select" value={form.ea} onChange={(e) => set("ea", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {eas.map((ea) => <option key={ea.id ?? ea.label} value={ea.label}>{ea.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="field"><label className="label">Entrada</label><input className="input" inputMode="decimal" value={form.entry_price} onChange={(e) => set("entry_price", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Stop Loss</label><input className="input" inputMode="decimal" value={form.stop_loss} onChange={(e) => set("stop_loss", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">TP1</label><input className="input" inputMode="decimal" value={form.tp1} onChange={(e) => set("tp1", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">TP2</label><input className="input" inputMode="decimal" value={form.tp2} onChange={(e) => set("tp2", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Resistencia</label><input className="input" inputMode="decimal" value={form.resistance} onChange={(e) => set("resistance", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Pivote</label><input className="input" inputMode="decimal" value={form.pivot} onChange={(e) => set("pivot", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Soporte</label><input className="input" inputMode="decimal" value={form.support} onChange={(e) => set("support", e.target.value)} disabled={isLocked} /></div>
        <div className="field">
          <label className="label">Tendencia</label>
          <select className="select" value={form.tendencia} onChange={(e) => set("tendencia", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            <option value="Alcista">Alcista</option>
            <option value="Bajista">Bajista</option>
            <option value="Lateral">Lateral</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Sesión</label>
          <select className="select" value={form.session} onChange={(e) => set("session", e.target.value)} disabled={isLocked}>
            <option value="">— Selecciona —</option>
            {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="field"><label className="label">RSI</label><input className="input" inputMode="decimal" value={form.rsi_value} onChange={(e) => set("rsi_value", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Estocástico K%</label><input className="input" inputMode="decimal" value={form.stochastic_k} onChange={(e) => set("stochastic_k", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">Estocástico D%</label><input className="input" inputMode="decimal" value={form.stochastic_d} onChange={(e) => set("stochastic_d", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">EMA20</label><input className="input" inputMode="decimal" value={form.ema20} onChange={(e) => set("ema20", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">EMA50</label><input className="input" inputMode="decimal" value={form.ema50} onChange={(e) => set("ema50", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">EMA100</label><input className="input" inputMode="decimal" value={form.ema100} onChange={(e) => set("ema100", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">EMA200</label><input className="input" inputMode="decimal" value={form.ema200} onChange={(e) => set("ema200", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">ATR</label><input className="input" inputMode="decimal" value={form.atr} onChange={(e) => set("atr", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">ADX</label><input className="input" inputMode="decimal" value={form.adx} onChange={(e) => set("adx", e.target.value)} disabled={isLocked} /></div>
        <div className="field"><label className="label">RVOL</label><input className="input" inputMode="decimal" value={form.rvol} onChange={(e) => set("rvol", e.target.value)} disabled={isLocked} /></div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Qué esperaba que pasara</label>
        <input className="input" value={form.expected_move} onChange={(e) => set("expected_move", e.target.value)} placeholder="Ej. rebote a TP1, ruptura de resistencia, caída a soporte..." disabled={isLocked} />
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="field" style={{ gridColumn: "span 3" }}>
          <label className="label">Motivo del fallo</label>
          <input className="input" value={form.failure_reason} onChange={(e) => set("failure_reason", e.target.value)} placeholder="Ej. rompió soporte, noticia contraria, falso breakout..." disabled={isLocked} />
        </div>
        <div className="field" style={{ gridColumn: "span 3" }}>
          <label className="label">Lecciones aprendidas</label>
          <textarea className="textarea" rows={4} value={form.lessons_learned} onChange={(e) => set("lessons_learned", e.target.value)} disabled={isLocked} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Notas</label>
        <textarea ref={notesRef} className="textarea" rows={9} value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={isLocked} />
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" type="submit" disabled={isLocked}>
          {saving ? "Guardando…" : mode === "create" ? "Crear Fake Trade" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
