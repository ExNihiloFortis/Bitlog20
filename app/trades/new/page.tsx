// ===================== [N1] app/trades/new/page.tsx =====================
// NUEVO TRADE (robusto sin information_schema)
// - Ticket (obligatorio) y user_id SIEMPRE se envían
// - Whitelist local de columnas válidas para no “tronar” si faltan en DB
// - Lado (BUY/SELL) arriba derecha; Timeframe baja a 2ª fila
// - Emoción (optgroups), EA con Calificación (ea_score)
// - Galería activa (Ctrl+V / botón / URL) vía ImageManager (cola en NEW)
// ========================================================================

"use client";

// ===================== [N2] Imports y tipos =====================
import React, { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";

type Opt = { id?: number; label: string };

// ===================== [N3] Constantes UI =====================
const SESSIONS = ["Asia", "London", "NY", "After-hours"] as const;
const DEFAULT_TFS = ["M5", "M15", "H1", "H4", "D1"];

const EMO_POS = ["Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción"];
const EMO_NEG = ["Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo"];

// ===================== [N4] Catálogos =====================
async function loadOptions(type: string): Promise<Opt[]> {
  const { data } = await supabase
    .from("catalog_items")
    .select("id,value,sort_index")
    .eq("type", type)
    .order("sort_index", { ascending: true })
    .order("value", { ascending: true });

  if (data?.length) return data.map((d) => ({ id: d.id, label: d.value }));

  if (type === "symbol") {
    const { data: ds } = await supabase.from("distinct_symbols").select("symbol").order("symbol");
    return (ds || []).map((r: any) => ({ label: r.symbol as string }));
  }
  return [];
}

// ===================== [N5] Whitelist de columnas conocidas =====================
// Si tu tabla no tiene alguna, no pasa nada; no la enviamos.
const TRADE_COLS = new Set([
  "user_id", "ticket", "session", "symbol", "timeframe",
  "ea", "patron", "vela", "tendencia",
  "pips", "rr_objetivo", "rr_objective", "pnl_usd_gross", "notes", "notas",
  "emocion", "side",
  "ea_signal", "ea_tp1", "ea_tp2", "ea_tp3", "ea_sl1", "ea_score",
  "volume"
]);

// ===================== [N6] Página =====================
export default function TradeNew() {
  // Catálogos
  const [symbols, setSymbols] = useState<Opt[]>([]);
  const [timeframes, setTimeframes] = useState<Opt[]>([]);
  const [eas, setEas] = useState<Opt[]>([]);
  const [patterns, setPatterns] = useState<Opt[]>([]);
  const [candles, setCandles] = useState<Opt[]>([]);

  // Estado general
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");

  // Form
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
    rr_objective: "",
    pnl_usd_gross: "",
    notas: "",

    emocion: "",
    side: "" as "" | "BUY" | "SELL",

    ea_signal: "BUY" as "BUY" | "SELL",
    ea_tp1: "",
    ea_tp2: "",
    ea_tp3: "",
    ea_sl1: "",
    ea_score: "", // 0-100

    volume: "",
  });

  const onChange = (k: keyof typeof form, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));
  const disabled = useMemo(() => loading || saving, [loading, saving]);

  // Colas de imágenes (NEW)
  const [queuedBlobs, setQueuedBlobs] = useState<Blob[]>([]);
  const [queuedUrls, setQueuedUrls] = useState<string[]>([]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? "";
        setUserId(uid);
        if (!uid) {
          window.location.href = "/login";
          return;
        }

        const [sy, tf, eaList, pa, ve] = await Promise.all([
          loadOptions("symbol"),
          loadOptions("timeframe"),
          loadOptions("ea"),
          loadOptions("pattern"),
          loadOptions("candle"),
        ]);

        setSymbols(sy);
        setTimeframes(tf.length ? tf : DEFAULT_TFS.map((x) => ({ label: x })));
        setEas(eaList);
        setPatterns(pa);
        setCandles(ve);

        setForm((s) => ({
          ...s,
          timeframe: (tf[0]?.label ?? DEFAULT_TFS[0]) || "",
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ===================== [N7] Build de payload robusto =====================
  function buildPayload(): Record<string, any> {
    const p: Record<string, any> = {};

    // SIEMPRE enviamos user_id y ticket
    p["user_id"] = userId || null;
    p["ticket"]  = form.ticket.trim();

    // Helper: incluir sólo si está en whitelist
    const put = (col: string, val: any) => {
      if (!TRADE_COLS.has(col)) return;
      if (val === "") {
        p[col] = null;
      } else {
        p[col] = val;
      }
    };

    put("session", form.session);
    put("symbol", form.symbol);
    put("timeframe", form.timeframe);
    put("ea", form.ea);
    put("patron", form.patron);
    put("vela", form.vela);
    put("tendencia", form.tendencia);

    put("pips", form.pips ? Number(form.pips) : null);
    put("pnl_usd_gross", form.pnl_usd_gross ? Number(form.pnl_usd_gross) : null);
    put("volume", form.volume ? Number(form.volume) : null);

    // RR (preferimos rr_objetivo)
    if (form.rr_objetivo) put("rr_objetivo", form.rr_objetivo);
    else if (form.rr_objective) put("rr_objective", form.rr_objective);

    // Notas: usa 'notes' si existe en DB; si no, 'notas'
    if (TRADE_COLS.has("notes")) put("notes", form.notas);
    else if (TRADE_COLS.has("notas")) put("notas", form.notas);

    // Emoción + Lado
    put("emocion", form.emocion);
    put("side", form.side);

    // Bloque EA
    put("ea_signal", form.ea_signal);
    put("ea_tp1", form.ea_tp1);
    put("ea_tp2", form.ea_tp2);
    put("ea_tp3", form.ea_tp3);
    put("ea_sl1", form.ea_sl1);
    if (form.ea_score !== "") put("ea_score", Number(form.ea_score));

    return p;
  }

  // ===================== [N8] Guardar =====================
  async function onSave(e: React.FormEvent) {
    e.preventDefault();

    if (!form.ticket.trim()) {
      alert("Ticket es obligatorio.");
      return;
    }
    if (!userId) {
      alert("Inicia sesión primero.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      const { data, error } = await supabase
        .from("trades")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      const tradeId = data!.id as number;

      // Subir colas (blobs y urls)
      for (const blob of queuedBlobs) {
        const ext = (blob.type.split("/")[1] || "png").toLowerCase();
        const key = `u_${userId}/t_${tradeId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("journal").upload(key, blob, {
          upsert: false,
          contentType: blob.type || "image/png",
        });
        if (!up.error) {
          await supabase.from("trade_images").insert({
            user_id: userId,
            trade_id: tradeId,
            title: "pasted",
            storage_path: key,
          });
        }
      }
      for (const url of queuedUrls) {
        await supabase.from("trade_images").insert({
          user_id: userId,
          trade_id: tradeId,
          title: "url",
          external_url: url,
        });
      }

      window.location.href = `/trades/${tradeId}`;
    } catch (e: any) {
      alert("Error al crear el trade: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  // ===================== [N9] UI =====================
  return (
    <>
      <TopNav />
      <div className="page-center">
        <div className="form-card">
          {/* Header */}
          <div className="form-head">
            <div className="form-title">Nuevo Trade</div>
            <span className="badge">/trades/new</span>
          </div>

          <form className="form-body" onSubmit={onSave}>
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
                  onChange={(e) => onChange("session", e.target.value)}
                  disabled={disabled}
                >
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
                  placeholder="Ej: 1:2 o 2.0"
                  value={form.rr_objetivo}
                  onChange={(e) => onChange("rr_objetivo", e.target.value)}
                  disabled={disabled}
                />
              </div>

              <div className="field">
                <label className="label">$ P&L (USD)</label>
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
                    {EMO_POS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Negativas">
                    {EMO_NEG.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="field">
                <label className="label">Notas</label>
                <textarea
                  className="textarea"
                  value={form.notas}
                  onChange={(e) => onChange("notas", e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Bloque EA: señal, TPs/SL y Calificación */}
            <div className="field" style={{ marginTop: 6 }}>
              <div className="label" style={{ marginBottom: 6 }}>EA (señal, niveles y calificación)</div>

              <div className="grid-3">
                <div className="field">
                  <label className="label">Señal EA</label>
                  <select
                    className="select"
                    value={form.ea_signal}
                    onChange={(e) => onChange("ea_signal", e.target.value)}
                    disabled={disabled}
                  >
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
                  <label className="label">SL1</label>
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
                    placeholder="75"
                    value={form.ea_score}
                    onChange={(e) => onChange("ea_score", e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="btn-row">
              <a href="/trades" className="btn secondary">Cancelar</a>
              <button className="btn" type="submit" disabled={disabled}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>

          {/* Galería (activa en NEW: cola blobs+urls) */}
          <div style={{ marginTop: 18, marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Galería (subir / pegar / URL)</div>
            <ImageManager
              tradeId={null}
              userId={userId}
              onQueueChange={setQueuedBlobs}
              onQueuedUrlsChange={setQueuedUrls}
            />
          </div>
        </div>
      </div>
    </>
  );
}

