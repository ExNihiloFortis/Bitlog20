// ===================== [/trades/[id]/edit/page.tsx] =====================
// Clon de /trades/new, pero en modo edición (update).
// Encabezado: "Editar Trade (Ticket #...)".
// =======================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";

type Opt = { id?: number; label: string };
const SESSIONS = ["Asia", "London", "NY", "After-hours"] as const;
const DEFAULT_TFS = ["M5", "M15", "H1", "H4", "D1"];

async function loadOptions(type: string): Promise<Opt[]> {
  const { data } = await supabase
    .from("catalog_items")
    .select("id,value,sort_index")
    .eq("type", type)
    .order("sort_index", { ascending: true })
    .order("value", { ascending: true });
  return (data || []).map((d) => ({ id: d.id, label: d.value }));
}

export default function EditTradePage() {
  const r = useRouter();
  const { id } = useParams<{ id: string }>();
  const tradeId = Number(id);

  const [userId, setUserId] = useState("");
  const [symbols, setSymbols] = useState<Opt[]>([]);
  const [timeframes, setTimeframes] = useState<Opt[]>([]);
  const [eas, setEas] = useState<Opt[]>([]);
  const [patterns, setPatterns] = useState<Opt[]>([]);
  const [candles, setCandles] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const onChange = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const disabled = useMemo(() => loading || saving, [loading, saving]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "";
      setUserId(uid);
      if (!uid) { r.push("/login"); return; }

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

      // Carga trade
      const { data, error } = await supabase
        .from("trades")
        .select("ticket,session,symbol,timeframe,ea,patron,vela,tendencia,pips,rr_objective,pnl_usd_gross,notes")
        .eq("id", tradeId)
        .single();
      if (error) throw error;

      setForm({
        ticket: data.ticket ?? "",
        session: data.session ?? "London",
        symbol: data.symbol ?? "",
        timeframe: data.timeframe ?? (tf[0]?.label ?? DEFAULT_TFS[0]),
        ea: data.ea ?? "",
        patron: data.patron ?? "",
        vela: data.vela ?? "",
        tendencia: data.tendencia ?? "",
        pips: data.pips ?? "",
        rr_objetivo: data.rr_objective ?? "",
        pnl_usd_gross: data.pnl_usd_gross ?? "",
        notas: data.notes ?? "",
      });

      setLoading(false);
    })();
  }, [tradeId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return alert("Inicia sesión primero.");
    if (!form.ticket.trim()) return alert("El campo Ticket es obligatorio.");
    setSaving(true);
    try {
      const payload: any = {
        ticket: form.ticket || null,
        session: form.session || null,
        symbol: form.symbol || null,
        timeframe: form.timeframe || null,
        ea: form.ea || null,
        patron: form.patron || null,
        vela: form.vela || null,
        tendencia: form.tendencia || null,
        pips: form.pips ? Number(form.pips) : null,
        rr_objective: form.rr_objetivo || null,
        pnl_usd_gross: form.pnl_usd_gross ? Number(form.pnl_usd_gross) : null,
        notes: form.notas || null,
      };
      const { error } = await supabase.from("trades").update(payload).eq("id", tradeId);
      if (error) throw error;
      r.push(`/trades/${tradeId}`);
    } catch (err: any) {
      alert("Error al guardar: " + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-center">
      <div className="form-card">
        <div className="form-head">
          <div className="form-title">Editar Trade (Ticket #{form.ticket || "—"})</div>
          <span className="badge">/trades/{tradeId}/edit</span>
        </div>

        <form className="form-body" onSubmit={onSubmit}>
          {/* (mismas 4 filas que /trades/new) */}
          <div className="grid-3">
            <div className="field">
              <label className="label">Ticket *</label>
              <input className="input" value={form.ticket} onChange={(e)=>onChange("ticket", e.target.value)} disabled={disabled}/>
            </div>
            <div className="field">
              <label className="label">Símbolo</label>
              <select className="select" value={form.symbol} onChange={(e)=>onChange("symbol", e.target.value)} disabled={disabled}>
                <option value="">— Selecciona —</option>
                {symbols.map((o)=> <option key={o.id ?? o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Timeframe</label>
              <select className="select" value={form.timeframe} onChange={(e)=>onChange("timeframe", e.target.value)} disabled={disabled}>
                {timeframes.map((o)=> <option key={o.id ?? o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Sesión</label>
              <select className="select" value={form.session} onChange={(e)=>onChange("session", e.target.value)} disabled={disabled}>
                {SESSIONS.map((s)=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">EA</label>
              <select className="select" value={form.ea} onChange={(e)=>onChange("ea", e.target.value)} disabled={disabled}>
                <option value="">— Selecciona —</option>
                {eas.map((o)=> <option key={o.id ?? o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Patrón</label>
              <select className="select" value={form.patron} onChange={(e)=>onChange("patron", e.target.value)} disabled={disabled}>
                <option value="">— Selecciona —</option>
                {patterns.map((o)=> <option key={o.id ?? o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Vela</label>
              <select className="select" value={form.vela} onChange={(e)=>onChange("vela", e.target.value)} disabled={disabled}>
                <option value="">— Selecciona —</option>
                {candles.map((o)=> <option key={o.id ?? o.label} value={o.label}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Tendencia</label>
              <select className="select" value={form.tendencia} onChange={(e)=>onChange("tendencia", e.target.value)} disabled={disabled}>
                <option value="">— Selecciona —</option>
                <option value="Alcista">Alcista</option>
                <option value="Bajista">Bajista</option>
                <option value="Lateral">Lateral</option>
              </select>
            </div>
            <div className="field">
              <label className="label">$ P&L (USD)</label>
              <input className="input" inputMode="decimal" value={form.pnl_usd_gross} onChange={(e)=>onChange("pnl_usd_gross", e.target.value)} disabled={disabled}/>
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="label">Pips</label>
              <input className="input" inputMode="decimal" value={form.pips} onChange={(e)=>onChange("pips", e.target.value)} disabled={disabled}/>
            </div>
            <div className="field">
              <label className="label">R objetivo</label>
              <input className="input" placeholder="Ej: 1:2 o 2.0" value={form.rr_objetivo} onChange={(e)=>onChange("rr_objetivo", e.target.value)} disabled={disabled}/>
            </div>
            <div className="field">
              <label className="label">Notas</label>
              <textarea className="textarea" value={form.notas} onChange={(e)=>onChange("notas", e.target.value)} disabled={disabled}/>
            </div>
          </div>

          <div className="btn-row">
            <a href={`/trades/${tradeId}`} className="btn secondary">Cancelar</a>
            <button type="submit" className="btn" disabled={disabled}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        </form>

        <div style={{ marginTop: 18, marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>Galería (subir / pegar / URL)</div>
          <ImageManager tradeId={tradeId} userId={userId} />
        </div>
      </div>
    </div>
  );
}

