// ===================== [BLOQUE TF-0] TradeForm ===============================
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";

// ---------------------------------------------------------------------------
// Catálogos locales (para los campos EDITABLES). Persistencia “real” la haremos
// más adelante con la página Field-Edits; aquí solo hace falta que funcionen.
// ---------------------------------------------------------------------------
const DEFAULT_SYMBOLS   = ["EURUSD","GBPUSD","USDJPY","BTCUSD","XAUUSD"];
const DEFAULT_TIMEFR   = ["M5","M15","H1","H4","D1"];
const DEFAULT_PATRONES = ["Breakout","Pullback","Reversal","FVG","BOS"];
const DEFAULT_VELAS    = ["Pin Bar","Engulfing","Doji","Hammer","Shooting Star"];
const DEFAULT_EAS      = ["Semaforo-ATR","WaveEMAs","Profitable-CandleStick","Fibonacci-GoldenZone"];

// Campos NO editables (listas cerradas)
const SESSION_OPTIONS = ["Sydney","Tokyo","London","New York","After-Hours"];
const TENDENCIAS      = ["Alcista","Bajista","Lateral"];
const EMO_POS         = ["Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción"];
const EMO_NEG         = ["Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo"];

// ---------------------------------------------------------------------------
// [BLOQUE 2.3] — SelectEditable (input + datalist + chips Añadir/Quitar)
// ---------------------------------------------------------------------------
function SelectEditable({
  id, label, value, setValue, options, setOptions, placeholder
}: {
  id: string; label: string; value: string;
  setValue: (v: string) => void;
  options: string[]; setOptions: (v: string[]) => void;
  placeholder?: string;
}) {
  const addCurrent = () => {
    const v = value.trim();
    if (!v) return;
    if (!options.includes(v)) setOptions([...options, v]);
  };
  const removeOpt = (opt: string) => {
    setOptions(options.filter(o => o !== opt));
    if (value === opt) setValue("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        list={id + "-list"}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder || label}
      />
      <datalist id={id + "-list"}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addCurrent}
          className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
        >
          Añadir a opciones
        </button>

        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <span key={o} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs">
              {o}
              <button type="button" onClick={() => removeOpt(o)} className="opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// [BLOQUE TF-1] — Componente principal
// ---------------------------------------------------------------------------
export default function TradeForm() {
  const r = useRouter();
  const [userId, setUserId] = useState<string>("");

  // imágenes pegadas/seleccionadas ANTES de tener tradeId
  const [queuedBlobs, setQueuedBlobs] = useState<Blob[]>([]);

  // Cargar userId
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) setUserId(data.user.id);
    })();
  }, []);

  // Estado del formulario
  const [form, setForm] = useState({
    ticket: "",
    symbol: "",
    timeframe: "",
    session: "London",
    ea: "",
    patron: "",
    tendencia: "",
    vela: "",
    emocion: "",
    pips: "",
    r_objetivo: "",
    pnl_usd_gross: "",
    notas: "",

    // Bloque EA
    ea_signal: "BUY",  // "BUY" | "SELL"
    ea_tp1: "",
    ea_tp2: "",
    ea_tp3: "",
    ea_sl1: "",
  });
  const onChange = (k: keyof typeof form, v: string) => setForm(s => ({ ...s, [k]: v }));

  // Opciones EDITABLES por usuario (en esta página)
  const [symbolOptions, setSymbolOptions]       = useState<string[]>(DEFAULT_SYMBOLS);
  const [timeframeOptions, setTimeframeOptions] = useState<string[]>(DEFAULT_TIMEFR);
  const [patronOptions, setPatronOptions]       = useState<string[]>(DEFAULT_PATRONES);
  const [velaOptions, setVelaOptions]           = useState<string[]>(DEFAULT_VELAS);
  const [eaOptions, setEaOptions]               = useState<string[]>(DEFAULT_EAS);

  // Extra: intenta seedear símbolos desde la vista distinct_symbols si existe.
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("distinct_symbols").select("symbol");
      if (!error && Array.isArray(data)) {
        const extra = data.map((x: any) => x.symbol).filter(Boolean);
        const merged = Array.from(new Set([...symbolOptions, ...extra]));
        setSymbolOptions(merged);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar
  const onSubmit = async () => {
    if (!userId) { alert("No hay sesión. Entra en /login."); return; }

    const payload: any = {
      user_id: userId,
      ticket: form.ticket || null,

      // EDITABLES
      symbol:   form.symbol   || null,
      timeframe:form.timeframe|| null,
      ea:       form.ea       || null,
      pattern:  form.patron   || null,
      candle:   form.vela     || null,

      // NO editables (lista cerrada)
      session:  form.session  || null,
      trend:    form.tendencia|| null,
      emotion:  form.emocion  || null,

      // numéricos
      pips:          form.pips ? Number(form.pips) : null,
      rr:            form.r_objetivo ? Number(form.r_objetivo) : null,
      pnl_usd_gross: form.pnl_usd_gross ? Number(form.pnl_usd_gross) : null,

      // varios
      notes:  form.notas || null,
      status: "CLOSED",
      ccy:    "USD",

      // Bloque EA
      ea_signal: form.ea_signal,
      ea_tp1: form.ea_tp1 || null,
      ea_tp2: form.ea_tp2 || null,
      ea_tp3: form.ea_tp3 || null,
      ea_sl1: form.ea_sl1 || null,
    };

    const { data, error } = await supabase.from("trades").insert(payload).select("id").single();
    if (error) { alert("Error al guardar trade: " + error.message); return; }
    const tradeId = data!.id as number;

    // subir blobs que estaban en cola
    for (const blob of queuedBlobs) {
      const ext = (blob.type.split("/")[1] || "png").toLowerCase();
      const key = `u_${userId}/t_${tradeId}/${crypto.randomUUID()}.${ext}`;
      const up  = await supabase.storage.from("journal").upload(key, blob, { upsert:false, contentType: blob.type });
      if (!up.error) {
        await supabase.from("trade_images").insert({ trade_id: tradeId, title: "pasted", storage_path: key });
      }
    }

    r.push(`/trades/${tradeId}`);
  };

  // ----------------------------- UI -----------------------------------------
  return (
    <div className="page-center">
      <div className="form-card">
        <div className="form-head">
          <div className="form-title">Nuevo Trade</div>
          <span className="badge">/trades/new</span>
        </div>

        <div className="form-body">
          {/* Grid 1 */}
          <div className="grid-3">
            {/* Ticket */}
            <div className="field">
              <label className="label">Ticket</label>
              <input
                className="input"
                value={form.ticket}
                onChange={(e)=>onChange("ticket", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Símbolo — EDITABLE */}
            <div className="field">
              <SelectEditable
                id="symbol"
                label="Símbolo"
                value={form.symbol}
                setValue={(v) => setForm(f => ({ ...f, symbol: v }))}
                options={symbolOptions}
                setOptions={setSymbolOptions}
                placeholder="Ej: EURUSD"
              />
            </div>

            {/* Timeframe — EDITABLE */}
            <div className="field">
              <SelectEditable
                id="timeframe"
                label="Timeframe"
                value={form.timeframe}
                setValue={(v) => setForm(f => ({ ...f, timeframe: v }))}
                options={timeframeOptions}
                setOptions={setTimeframeOptions}
              />
            </div>
          </div>

          {/* Grid 2 */}
          <div className="grid-3">
            {/* Sesión — NO editable */}
            <div className="field">
              <label className="label">Sesión</label>
              <select
                className="select"
                value={form.session}
                onChange={(e)=>onChange("session", e.target.value)}
              >
                {SESSION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* EA — EDITABLE */}
            <div className="field">
              <SelectEditable
                id="ea"
                label="EA"
                value={form.ea}
                setValue={(v) => setForm(f => ({ ...f, ea: v }))}
                options={eaOptions}
                setOptions={setEaOptions}
              />
            </div>

            {/* Patrón — EDITABLE */}
            <div className="field">
              <SelectEditable
                id="patron"
                label="Patrón"
                value={form.patron}
                setValue={(v) => setForm(f => ({ ...f, patron: v }))}
                options={patronOptions}
                setOptions={setPatronOptions}
              />
            </div>
          </div>

          {/* Grid 3 */}
          <div className="grid-3">
            {/* Tendencia — NO editable */}
            <div className="field">
              <label className="label">Tendencia</label>
              <select
                className="select"
                value={form.tendencia}
                onChange={(e)=>onChange("tendencia", e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {TENDENCIAS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Vela — EDITABLE */}
            <div className="field">
              <SelectEditable
                id="vela"
                label="Vela"
                value={form.vela}
                setValue={(v) => setForm(f => ({ ...f, vela: v }))}
                options={velaOptions}
                setOptions={setVelaOptions}
              />
            </div>

            {/* Emoción — NO editable (grupos) */}
            <div className="field">
              <label className="label">Emoción</label>
              <select
                className="select"
                value={form.emocion}
                onChange={(e)=>onChange("emocion", e.target.value)}
              >
                <option value="">— Selecciona —</option>
                <optgroup label="Positivas">
                  {EMO_POS.map(e => <option key={e} value={e}>{e}</option>)}
                </optgroup>
                <optgroup label="Negativas">
                  {EMO_NEG.map(e => <option key={e} value={e}>{e}</option>)}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Grid 4 */}
          <div className="grid-3">
            <div className="field">
              <label className="label">Pips</label>
              <input className="input" inputMode="decimal" value={form.pips} onChange={(e)=>onChange("pips", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">R objetivo</label>
              <input className="input" inputMode="decimal" value={form.r_objetivo} onChange={(e)=>onChange("r_objetivo", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">$ P&amp;L (USD)</label>
              <input className="input" inputMode="decimal" value={form.pnl_usd_gross} onChange={(e)=>onChange("pnl_usd_gross", e.target.value)} />
            </div>
          </div>

          {/* Notas */}
          <div className="field">
            <label className="label">Notas</label>
            <textarea
              className="textarea"
              value={form.notas}
              onChange={(e)=>onChange("notas", e.target.value)}
              placeholder="Contexto, confluencias, gestión..."
            />
          </div>

          {/* [BLOQUE 2.6] — Card EA (entre Notas y botón Crear) */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3" style={{marginTop: 10, marginBottom: 10}}>
            <div className="text-sm font-semibold tracking-wide opacity-80">EA</div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Señal</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                value={form.ea_signal}
                onChange={(e) => setForm(f => ({ ...f, ea_signal: e.target.value }))}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {k:"ea_tp1", label:"TP1", ph:"2.50 o 5%"},
                {k:"ea_tp2", label:"TP2", ph:"3.50 o 8%"},
                {k:"ea_tp3", label:"TP3", ph:"4.20 o 10%"},
                {k:"ea_sl1", label:"SL1", ph:"-1.50 o -3%"},
              ].map(({k,label,ph})=>(
                <div key={k} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                    value={(form as any)[k]}
                    onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
                    placeholder={`Ej: ${ph}`}
                  />
                </div>
              ))}
            </div>

            <p className="text-xs opacity-60">
              Aquí registras la señal y niveles del EA para evaluar luego si alcanzó TP/SL.
            </p>
          </div>

          {/* Galería (subir / pegar / URL) */}
          <div style={{marginTop:18, marginBottom:12}}>
            <div className="label" style={{marginBottom:6}}>Galería</div>
            <ImageManager
              tradeId={null}
              userId={userId}
              onQueueChange={(q)=>setQueuedBlobs(q)}
            />
          </div>

          {/* Botones */}
          <div className="btn-row">
            <button className="btn secondary" type="button" onClick={()=>history.back()}>Cancelar</button>
            <button className="btn" type="button" onClick={onSubmit}>Guardar trade</button>
          </div>
        </div>
      </div>
    </div>
  );
}

