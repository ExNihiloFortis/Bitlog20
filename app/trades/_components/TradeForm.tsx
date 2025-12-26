// ===================== [TF1] app/trades/_components/TradeForm.tsx =====================
// Formulario global de Trade (NEW + EDIT)
// - Mantiene layout estable (3 columnas) para el bloque superior (manual)
// - Inserción de emojis en el cursor de "Notas" con panel tipo dropdown (grid/wrap)
// - Bloque EA se mantiene separado abajo
// ========================================================================

"use client";

// ===================== [TF2] Imports y tipos básicos =====================
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Opt = { id?: number; label: string };

// ===================== [TF3] Constantes UI =====================
const SESSIONS = ["Sydney", "Tokyo", "London", "New York", "After-Hours"] as const;

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

// Emojis (panel dropdown) — texto puro, no pesa
const EMOJIS = [
  "😀","🤣","😇","😘","😛","😜","🤪","🥰","😍","🤩","😘","😛","😜","🤪","🤑","🤔","🤨","😐","😑","😶","🤮","🤧","😵","😵‍💫","🤯","🥳","😎","🤓","🥸","😕","😟","☹️","😮","😯","😳","🥺","😧","😨","😰","😥","😭","😱","🤦‍♂️","😖","😞","😓","😩","😫","🥱","😡","😠","🤬","😈","💀","💩","🤡","🤖","💯","💥","👌","🤌","🤏","✌️","☝️","👊","👍","👐","🙏","✍️","💪","🧠","🫀","💔","❤️‍🔥","❤️","🥞","🧀","🥩","🍔","🍟","🍕","🌭","🌮","🍿","🍤","🍦","🍰","🥧","☕","🍾","🍷","🍹","🍺","🍻","🥂","🍽️","🍴","✨","🎈","🎉","🎊","🎁","🎖️","🏆","🏅","🥇","🎯","👨‍🎓","🧟","🧟‍♂️","🧟‍♀️","🧔","🌍","🌎","🏖️","🏝️","🌅","🌆","🌇","🌉","🚅","🚝","🚥","🚦","⌛","⏳","⌚","⏱️","🌒","🌔","🌞","⭐","🌟","☁️","⛅","⛈️","🌤️","🌩️","⛱️","⚡","❄️","🔥","🎩","🔇","📢","🔔","🔕","📔","📘","📚","📓","📒","📰","🗞️","📑","💰","🪙","💸","🖋️","🗂️","📅","🗓️","📌","📎","🗑️","💣","✅","☑️","✔️","❌","❎","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","⚠️","⛔","🚫","🚳"
] as const;

// ===================== [TF4] Tipo de estado del formulario =====================
type TradeFormState = {
  // Col 1
  ticket: string;
  session: (typeof SESSIONS)[number] | "";
  patron: string;
  entry_price: string;
  pips: string;
  volume: string;

  // Col 2
  symbol: string;
  timeframe: string;
  vela: string;
  exit_price: string;
  rr_objetivo: string;
  emocion: string;

  // Col 3
  side: string;
  ea: string;
  tendencia: string;
  pnl_usd_gross: string;
  notas: string;

  // Otros (mantener)
  close_reason: string;

  // Bloque EA (se mantiene abajo)
  ea_signal: string;
  ea_tp1: string;
  ea_tp2: string;
  ea_tp3: string;
  ea_sl1: string;
  ea_score: string;
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

// ===================== [TF5.9] Props =====================
export type TradeFormValues = { [key: string]: any };
type TradeFormMode = "create" | "edit";

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

  // ---------- [TF6.2] Ref textarea + emoji dropdown ----------
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiWrapRef = useRef<HTMLDivElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // ---------- [TF6.3] Estado del formulario ----------
  const [form, setForm] = useState<TradeFormState>(() => ({
    // Col 1
    ticket: initialValues?.ticket ?? "",
    session:
      (initialValues?.session as TradeFormState["session"]) ??
      ("London" as TradeFormState["session"]),
    patron: initialValues?.patron ?? "",
    entry_price: initialValues?.entry_price ?? "",
    pips: initialValues?.pips ?? "",
    volume: initialValues?.volume ?? "",

    // Col 2
    symbol: initialValues?.symbol ?? "",
    timeframe: initialValues?.timeframe ?? "",
    vela: initialValues?.vela ?? "",
    exit_price: initialValues?.exit_price ?? "",
    rr_objetivo: initialValues?.rr_objetivo ?? "",
    emocion: initialValues?.emocion ?? "",

    // Col 3
    side: initialValues?.side ?? "",
    ea: initialValues?.ea ?? "",
    tendencia: initialValues?.tendencia ?? "",
    pnl_usd_gross: initialValues?.pnl_usd_gross ?? "",
    notas: initialValues?.notas ?? "",

    close_reason: initialValues?.close_reason ?? "",

    // Bloque EA
    ea_signal: initialValues?.ea_signal ?? "",
    ea_tp1: initialValues?.ea_tp1 ?? "",
    ea_tp2: initialValues?.ea_tp2 ?? "",
    ea_tp3: initialValues?.ea_tp3 ?? "",
    ea_sl1: initialValues?.ea_sl1 ?? "",
    ea_score: initialValues?.ea_score ?? "",
  }));

  // ---------- [TF6.4] Sincronizar cuando cambien initialValues ----------
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

  // ---------- [TF6.5] Cargar catálogos ----------
  useEffect(() => {
    (async () => {
      try {
        const [sym, tfs, eaOpts, pat, vel] = await Promise.all([
          loadOptions("symbol"),
          loadOptions("timeframe"),
          loadOptions("ea"),
          loadOptions("pattern"),
          loadOptions("candle"),
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

  // ---------- [TF6.6] Cerrar panel de emojis al click fuera ----------
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!emojiOpen) return;
      const wrap = emojiWrapRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target as Node)) return;
      setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [emojiOpen]);

  // ---------- [TF6.7] Helper de cambio ----------
  function onChange<K extends keyof TradeFormState>(field: K, value: TradeFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------- [TF6.8] Insertar emoji en cursor ----------
  function insertEmojiAtCursor(emoji: string) {
    if (disabled) return;

    const el = notesRef.current;
    const current = form.notas ?? "";

    if (!el) {
      onChange("notas", (current + emoji) as any);
      setEmojiOpen(false);
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;

    const next = current.slice(0, start) + emoji + current.slice(end);
    onChange("notas", next as any);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      } catch {
        // no-op
      }
    });
  }

  // ---------- [TF6.9] Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  // ===================== [TF7] JSX =====================
  return (
    <form className="form-body" onSubmit={handleSubmit}>
      {/* ===================== [TF7.1] BLOQUE SUPERIOR (3 columnas fijas) ===================== */}
      <div className="grid-3">
        {/* --------- Columna 1 --------- */}
        <div className="col">
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
            <label className="label">Volumen (Lotaje)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.volume}
              onChange={(e) => onChange("volume", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* --------- Columna 2 --------- */}
        <div className="col">
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
            <label className="label">Precio de Cierre</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.exit_price}
              onChange={(e) => onChange("exit_price", e.target.value)}
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
        </div>

        {/* --------- Columna 3 --------- */}
        <div className="col">
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

          {/* =========== Emojis (panel tipo dropdown con filas/wrap) =========== */}
          <div className="field" ref={emojiWrapRef}>
            <label className="label">Emojis</label>

            <button
              type="button"
              className="btn secondary"
              onClick={() => setEmojiOpen((v) => !v)}
              disabled={disabled}
              style={{ width: "100%", justifyContent: "space-between" }}
              aria-expanded={emojiOpen}
            >
              <span>Insertar emoji en Notas</span>
              <span style={{ opacity: 0.8 }}>{emojiOpen ? "▲" : "▼"}</span>
            </button>

            {emojiOpen && (
              <div
                style={{
                  marginTop: 8,
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: 10,
                  background: "white",
                  maxHeight: 180,
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {EMOJIS.map((emo, i) => (
                    <button
                      key={`${emo}-${i}`}
                      type="button"
                      onClick={() => insertEmojiAtCursor(emo)}
                      disabled={disabled}
                      title={emo}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "white",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: "34px",
                        textAlign: "center",
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Notas</label>
            <textarea
              ref={notesRef}
              className="textarea"
              rows={3}
              value={form.notas}
              onChange={(e) => onChange("notas", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* ===================== [TF7.2] Otros campos sueltos (si los usas) ===================== */}
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
        <div className="field" />
        <div className="field" />
      </div>

      {/* ===================== [TF7.3] BLOQUE EA (NO se mezcla con el bloque superior) ===================== */}
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
          <label className="label">TP1</label>
          <input
            className="input"
            value={form.ea_tp1}
            onChange={(e) => onChange("ea_tp1", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">TP2</label>
          <input
            className="input"
            value={form.ea_tp2}
            onChange={(e) => onChange("ea_tp2", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label className="label">TP3</label>
          <input
            className="input"
            value={form.ea_tp3}
            onChange={(e) => onChange("ea_tp3", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">SL1 (referencia)</label>
          <input
            className="input"
            value={form.ea_sl1}
            onChange={(e) => onChange("ea_sl1", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label className="label">Calificación (0–100)</label>
          <input
            className="input"
            inputMode="numeric"
            value={form.ea_score}
            onChange={(e) => onChange("ea_score", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ===================== [TF7.4] Acciones ===================== */}
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

