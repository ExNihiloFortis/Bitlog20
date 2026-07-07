"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opt = { id?: number; label: string };
type Mode = "create" | "edit";

export type FakeTradeFormValues = {
  symbol: string;
  side: "" | "BUY" | "SELL";
  timeframe: string;
  setup_datetime: string;
  source_type: "PROPIA" | "EXTERNA";
  source_name: string;
  source_url: string;
  pattern_name: string;
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  expected_move: string;
  result: "PENDING" | "WIN" | "LOSS" | "NEUTRAL";
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
    return data.map((d: any) => ({ id: d.id, label: d.value as string }));
  }

  if (type === "symbol") {
    const { data: ds } = await supabase
      .from("distinct_symbols")
      .select("symbol")
      .order("symbol");
    return (ds || []).map((r: any) => ({ label: r.symbol as string }));
  }

  return [];
}

const INITIAL_NOTES = `Idea / razón del fake trade:

Qué tendría que pasar para cumplirse:

Qué invalidaría la idea:

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

  const [form, setForm] = useState<FakeTradeFormValues>({
    symbol: initialValues.symbol ?? "",
    side: initialValues.side ?? "",
    timeframe: initialValues.timeframe ?? "",
    setup_datetime: initialValues.setup_datetime ?? "",
    source_type: initialValues.source_type ?? "PROPIA",
    source_name: initialValues.source_name ?? "",
    source_url: initialValues.source_url ?? "",
    pattern_name: initialValues.pattern_name ?? "",
    entry_price: initialValues.entry_price ?? "",
    stop_loss: initialValues.stop_loss ?? "",
    take_profit: initialValues.take_profit ?? "",
    expected_move: initialValues.expected_move ?? "",
    result: initialValues.result ?? "PENDING",
    notes: initialValues.notes ?? INITIAL_NOTES,
  });

  useEffect(() => {
    setForm((p) => ({ ...p, ...initialValues } as FakeTradeFormValues));
  }, [initialValues]);

  useEffect(() => {
    (async () => {
      const [sym, tf, pat] = await Promise.all([
        loadOptions("symbol"),
        loadOptions("timeframe"),
        loadOptions("pattern"),
      ]);
      setSymbols(sym);
      setTimeframes(tf);
      setPatterns(pat);
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

  return (
    <form onSubmit={submit}>
      <div className="grid-3">
        <div className="field">
          <label className="label">Símbolo *</label>
          <input
            className="input"
            list="fake-symbols"
            value={form.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            placeholder="AAPL, NVDA, EURUSD..."
            disabled={disabled || saving}
          />
          <datalist id="fake-symbols">
            {symbols.map((s) => <option key={s.label} value={s.label} />)}
          </datalist>
        </div>

        <div className="field">
          <label className="label">Lado</label>
          <select className="select" value={form.side} onChange={(e) => set("side", e.target.value as any)} disabled={disabled || saving}>
            <option value="">—</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Resultado</label>
          <select className="select" value={form.result} onChange={(e) => set("result", e.target.value as any)} disabled={disabled || saving}>
            <option value="PENDING">Pendiente</option>
            <option value="WIN">Se cumplió</option>
            <option value="LOSS">No se cumplió</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Timeframe</label>
          <input className="input" list="fake-timeframes" value={form.timeframe} onChange={(e) => set("timeframe", e.target.value)} disabled={disabled || saving} />
          <datalist id="fake-timeframes">
            {timeframes.map((t) => <option key={t.label} value={t.label} />)}
          </datalist>
        </div>

        <div className="field">
          <label className="label">Fecha / hora</label>
          <input type="datetime-local" className="input" value={form.setup_datetime} onChange={(e) => set("setup_datetime", e.target.value)} disabled={disabled || saving} />
        </div>

        <div className="field">
          <label className="label">Origen</label>
          <select className="select" value={form.source_type} onChange={(e) => set("source_type", e.target.value as any)} disabled={disabled || saving}>
            <option value="PROPIA">Decisión propia</option>
            <option value="EXTERNA">Señal / alerta externa</option>
          </select>
        </div>

        <div className="field">
          <label className="label">Sitio / fuente</label>
          <input className="input" value={form.source_name} onChange={(e) => set("source_name", e.target.value)} placeholder="TradingView, X, Discord..." disabled={disabled || saving} />
        </div>

        <div className="field">
          <label className="label">URL de la señal</label>
          <input className="input" value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://..." disabled={disabled || saving} />
        </div>

        <div className="field">
          <label className="label">Patrón</label>
          <input className="input" list="fake-patterns" value={form.pattern_name} onChange={(e) => set("pattern_name", e.target.value)} disabled={disabled || saving} />
          <datalist id="fake-patterns">
            {patterns.map((p) => <option key={p.label} value={p.label} />)}
          </datalist>
        </div>

        <div className="field">
          <label className="label">Entrada</label>
          <input className="input" inputMode="decimal" value={form.entry_price} onChange={(e) => set("entry_price", e.target.value)} disabled={disabled || saving} />
        </div>

        <div className="field">
          <label className="label">Stop Loss</label>
          <input className="input" inputMode="decimal" value={form.stop_loss} onChange={(e) => set("stop_loss", e.target.value)} disabled={disabled || saving} />
        </div>

        <div className="field">
          <label className="label">Take Profit</label>
          <input className="input" inputMode="decimal" value={form.take_profit} onChange={(e) => set("take_profit", e.target.value)} disabled={disabled || saving} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Qué esperaba que pasara</label>
        <input className="input" value={form.expected_move} onChange={(e) => set("expected_move", e.target.value)} placeholder="Ej. rebote a EMA 20, ruptura de resistencia, caída a soporte..." disabled={disabled || saving} />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Notas</label>
        <textarea ref={notesRef} className="textarea" rows={10} value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={disabled || saving} />
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn primary" type="submit" disabled={disabled || saving}>
          {saving ? "Guardando…" : mode === "create" ? "Crear Fake Trade" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
