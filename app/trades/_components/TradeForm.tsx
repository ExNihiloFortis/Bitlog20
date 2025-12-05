// ===================== [TF1] app/trades/_components/TradeForm.tsx =====================
// Formulario global de Trade (NEW + EDIT)
// - Maneja el estado del formulario (ticket, símbolo, sesión, EA, patrón, vela, etc.)
// - Carga catálogos desde Supabase (símbolos, timeframes, EAs, patrones, velas)
// - No hace inserts/updates: el padre decide qué hacer en onSubmit
// ========================================================================

"use client";

// ===================== [TF2] Imports y tipos básicos =====================
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opt = { id?: number; label: string };

// ===================== [TF3] Constantes UI =====================
// Sesiones válidas alineadas con trades_session_check
const SESSIONS = ["Sydney", "Tokyo", "London", "New York", "After-Hours"] as const;

// Emociones (puedes ajustar textos después si lo deseas)
const EMO_POS = [
  "Alegría",
  "Calma",
  "Confianza",
  "Curiosidad",
  "Excitación",
  "Optimismo",
  "Satisfacción",
];

const EMO_NEG = [
  "Aburrimiento",
  "Ansiedad",
  "Arrepentimiento",
  "Duda",
  "Fatiga",
  "Frustración",
  "Ira",
  "Miedo",
];

// ===================== [TF4] Tipo de estado del formulario =====================
type TradeFormState = {
  ticket: string;
  session: (typeof SESSIONS)[number] | "";
  symbol: string;
  timeframe: string;

  ea: string;
  patron: string;
  vela: string;
  tendencia: string;

  // Nuevos campos de precio
  entry_price: string;
  exit_price: string;

  pips: string;
  rr_objetivo: string;
  pnl_usd_gross: string;
  volume: string;

  emocion: string;
  side: string;

  // Nuevo campo de close reason
  close_reason: string;

  ea_signal: string;
  ea_tp1: string;
  ea_tp2: string;
  ea_tp3: string;
  ea_sl1: string;
  ea_score: string;

  notas: string;
};









// ===================== [TF5] Helper: carga de catálogos desde Supabase =====================
async function loadOptions(type: string): Promise<Opt[]> {
  const { data } = await supabase
    .from("catalog_items")
    .select("id,value,sort_index")
    .eq("type", type)
    .order("sort_index", { ascending: true })
    .order("value", { ascending: true });

  if (data?.length) {
    // Orden alfabético por valor, por si acaso
    return data
      .map((d) => ({ id: d.id, label: d.value as string }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  if (type === "symbol") {
    const { data: ds } = await supabase
      .from("distinct_symbols")
      .select("symbol")
      .order("symbol");

    return (ds || [])
      .map((r: any) => ({ label: r.symbol as string }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return [];
}

// ===================== [TF5.9] Tipos de formulario y props =====================

// Forma flexible de los valores del formulario.
// Si en el futuro agregamos más campos, no habrá problema.
export type TradeFormValues = {
  [key: string]: any;
};

// Modo de uso del formulario: crear o editar
type TradeFormMode = "create" | "edit";


// Props esperadas por el componente TradeForm
type TradeFormProps = {
  mode: TradeFormMode;
  initialValues: TradeFormValues;
  disabled?: boolean;
  saving?: boolean;
  onSubmit: (values: TradeFormValues) => Promise<void> | void;
};


// ===================== [TF6] Componente principal TradeForm =====================
export default function TradeForm(props: TradeFormProps) {
  const { mode, initialValues, disabled = false, saving = false, onSubmit } = props;

  // ---------- [TF6.1] Estado de catálogos ----------
  const [symbols, setSymbols] = useState<Opt[]>([]);
  const [timeframes, setTimeframes] = useState<Opt[]>([]);
  const [eas, setEas] = useState<Opt[]>([]);
  const [patterns, setPatterns] = useState<Opt[]>([]);
  const [candles, setCandles] = useState<Opt[]>([]);

// ---------- [TF6.2] Estado del formulario ----------
const [form, setForm] = useState<TradeFormState>(() => ({
  ticket: initialValues?.ticket ?? "",
  session:
    (initialValues?.session as TradeFormState["session"]) ??
    ("London" as TradeFormState["session"]),
  symbol: initialValues?.symbol ?? "",
  timeframe: initialValues?.timeframe ?? "",

  ea: initialValues?.ea ?? "",
  patron: initialValues?.patron ?? "",
  vela: initialValues?.vela ?? "",
  tendencia: initialValues?.tendencia ?? "",

  entry_price: initialValues?.entry_price ?? "",
  exit_price: initialValues?.exit_price ?? "",

  pips: initialValues?.pips ?? "",
  rr_objetivo: initialValues?.rr_objetivo ?? "",
  pnl_usd_gross: initialValues?.pnl_usd_gross ?? "",
  volume: initialValues?.volume ?? "",

  emocion: initialValues?.emocion ?? "",
  side: initialValues?.side ?? "",

  close_reason: initialValues?.close_reason ?? "",

  ea_signal: initialValues?.ea_signal ?? "",
  ea_tp1: initialValues?.ea_tp1 ?? "",
  ea_tp2: initialValues?.ea_tp2 ?? "",
  ea_tp3: initialValues?.ea_tp3 ?? "",
  ea_sl1: initialValues?.ea_sl1 ?? "",
  ea_score: initialValues?.ea_score ?? "",

  notas: initialValues?.notas ?? "",
}));




  // ---------- [TF6.3] Sincronizar cuando cambien initialValues ----------
  useEffect(() => {
    if (!initialValues) return;
    setForm((prev) => ({
      ...prev,
      ...initialValues,
      session:
        ((initialValues.session as TradeFormState["session"]) ??
          prev.session ??
          "London") as TradeFormState["session"],
    }));
  }, [initialValues]);

// ---------- [TF6.4] Cargar catálogos al montar ----------
useEffect(() => {
  (async () => {
    try {
      const [sym, tfs, eaOpts, pat, vel] = await Promise.all([
        loadOptions("symbol"),
        loadOptions("timeframe"),
        loadOptions("ea"),
        loadOptions("pattern"), // <- patrones (field-edits tipo "pattern")
        loadOptions("candle"),  // <- velas (field-edits tipo "candle")
      ]);

      setSymbols(sym);
      setTimeframes(tfs);
      setEas(eaOpts);
      setPatterns(pat);
      setCandles(vel);
    } catch (e) {
      console.error("Error cargando catálogos en TradeForm:", e);
    }
  })();
}, []);


  // ---------- [TF6.5] Helper de cambio de campo ----------
  function onChange<K extends keyof TradeFormState>(field: K, value: TradeFormState[K]) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // ---------- [TF6.6] Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  // ===================== [TF7] JSX del formulario =====================
  // NOTA: Este JSX está basado en el layout de /trades/new actual.
  // Cuando lo uses en /trades/new y /trades/[id]/edit, envuélvelo en la misma card/contenedor.
  return (
    <form className="form-body" onSubmit={handleSubmit}>
      {/* Fila 1: Ticket | Símbolo | Lado (arriba der) */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Ticket *</label>
          <input
            className="input"
            value={form.ticket}
            onChange={(e) => onChange("ticket", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">Símbolo</label>
          <select
            className="select"
            value={form.symbol}
            onChange={(e) => onChange("symbol", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {symbols.map((o) => (
              <option key={o.id ?? o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Lado</label>
          <select
            className="select"
            value={form.side}
            onChange={(e) => onChange("side", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
      </div>

      {/* Fila 2: Sesión | Timeframe | EA */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Sesión</label>
          <select
            className="select"
            value={form.session}
            onChange={(e) =>
              onChange("session", e.target.value as TradeFormState["session"])
            }
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {SESSIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Timeframe</label>
          <select
            className="select"
            value={form.timeframe}
            onChange={(e) => onChange("timeframe", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {timeframes.map((o) => (
              <option key={o.id ?? o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">EA</label>
          <select
            className="select"
            value={form.ea}
            onChange={(e) => onChange("ea", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {eas.map((o) => (
              <option key={o.id ?? o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      
      {/* Fila 3: Patrón | Vela | Tendencia */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Patrón</label>
          <select
            className="select"
            value={form.patron}
            onChange={(e) => onChange("patron", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {patterns.map((o) => (
              <option key={o.id ?? o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Vela</label>
          <select
            className="select"
            value={form.vela}
            onChange={(e) => onChange("vela", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            {candles.map((o) => (
              <option key={o.id ?? o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Tendencia</label>
          <select
            className="select"
            value={form.tendencia}
            onChange={(e) => onChange("tendencia", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            <option value="Alcista">Alcista</option>
            <option value="Bajista">Bajista</option>
            <option value="Lateral">Lateral</option>
          </select>
        </div>
      </div>
      
            {/* Fila extra: Precio de Apertura | Precio de Cierre | (vacío) */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Precio de Apertura</label>
          <input
            className="input"
            inputMode="decimal"
            value={form.entry_price}
            onChange={(e) => onChange("entry_price", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">Precio de Cierre</label>
          <input
            className="input"
            inputMode="decimal"
            value={form.exit_price}
            onChange={(e) => onChange("exit_price", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">{/* columna vacía para mantener 3 columnas */}</div>
      </div>

      {/* Fila 4: Pips | R objetivo | $P&L */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Pips</label>
          <input
            className="input"
            inputMode="decimal"
            value={form.pips}
            onChange={(e) => onChange("pips", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">R objetivo</label>
          <input
            className="input"
            placeholder="1:2 / 1:3 / etc."
            value={form.rr_objetivo}
            onChange={(e) => onChange("rr_objetivo", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">$P&L (bruto)</label>
          <input
            className="input"
            inputMode="decimal"
            value={form.pnl_usd_gross}
            onChange={(e) => onChange("pnl_usd_gross", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Fila 5: Volumen | Emoción | Notas */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Volumen (Lotaje)</label>
          <input
            className="input"
            inputMode="decimal"
            value={form.volume}
            onChange={(e) => onChange("volume", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">Emoción</label>
          <select
            className="select"
            value={form.emocion}
            onChange={(e) => onChange("emocion", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            <optgroup label="Positivas">
              {EMO_POS.map((emo) => (
                <option key={emo} value={emo}>
                  {emo}
                </option>
              ))}
            </optgroup>
            <optgroup label="Negativas">
              {EMO_NEG.map((emo) => (
                <option key={emo} value={emo}>
                  {emo}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="field">
          <label className="label">Notas</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.notas}
            onChange={(e) => onChange("notas", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      
            {/* Fila extra: Close Reason */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Close Reason (TP/SL/OTHER)</label>
          <select
            className="select"
            value={form.close_reason}
            onChange={(e) => onChange("close_reason", e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecciona —</option>
            <option value="TP">TP</option>
            <option value="SL">SL</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div className="field">{/* vacío para mantener 3 columnas */}</div>
        <div className="field">{/* vacío para mantener 3 columnas */}</div>
      </div>

      
      
      
      
      
      
      
      
      
      
      

      {/* Fila 6: Bloque EA (Señal, TPs, SL, Score) */}
      <div className="grid-3">
       <div className="field">
  <label className="label">Señal EA (BUY/SELL)</label>
  <select
    className="select"
    value={form.ea_signal}
    onChange={(e) => onChange("ea_signal", e.target.value)}
    disabled={disabled}
  >
    <option value="">— Selecciona —</option>
    <option value="BUY">BUY</option>
    <option value="SELL">SELL</option>
  </select>
</div>
  
        <div className="field">
          <label className="label">TP1 / TP2 / TP3</label>
          <div className="grid-3 compact">
            <input
              className="input"
              placeholder="TP1"
              value={form.ea_tp1}
              onChange={(e) => onChange("ea_tp1", e.target.value)}
              disabled={disabled}
            />
            <input
              className="input"
              placeholder="TP2"
              value={form.ea_tp2}
              onChange={(e) => onChange("ea_tp2", e.target.value)}
              disabled={disabled}
            />
            <input
              className="input"
              placeholder="TP3"
              value={form.ea_tp3}
              onChange={(e) => onChange("ea_tp3", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">SL1 (referencia)</label>
          <input
            className="input"
            placeholder="SL1"
            value={form.ea_sl1}
            onChange={(e) => onChange("ea_sl1", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Fila 7: Score de la señal */}
      <div className="grid-3">
        <div className="field">
          <label className="label">Calificación (0–100)</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="75"
            value={form.ea_score}
            onChange={(e) => onChange("ea_score", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="btn-row">
        <a href="/trades" className="btn secondary">
          Cancelar
        </a>
        <button className="btn" type="submit" disabled={disabled}>
          {saving ? "Guardando..." : mode === "edit" ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

