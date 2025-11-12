"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";
import useCatalogOptions from "@/lib/useCatalogOptions"; // obtiene symbol/timeframe/ea/pattern/candle desde /field-edits

type Trade = {
  id: number;
  user_id: string;
  ticket: string | null;

  symbol: string | null;
  timeframe: string | null;
  ea: string | null;
  patron: string | null;   // pattern
  vela: string | null;     // candle

  side: "BUY" | "SELL" | null;
  session: string | null;
  tendencia: string | null;
  emocion: string | null;

  entry_price: number | null;
  exit_price: number | null;
  volume: number | null;
  pnl_usd_gross: number | null;

  pips: number | null;
  rr_objetivo: string | null;

  ea_signal: "BUY" | "SELL" | null;
  ea_tp1: string | null;
  ea_tp2: string | null;
  ea_tp3: string | null;
  ea_sl1: string | null;
  ea_score: number | null;

  opening_time_utc: string | null;
  closing_time_utc: string | null;
  close_reason: string | null;

  notes: string | null;
};

function FieldText({ label, value, onChange, required=false }:{
  label:string; value:string; onChange:(v:string)=>void; required?:boolean;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input className="input" value={value} onChange={(e)=>onChange(e.target.value)} required={required}/>
    </div>
  );
}

function FieldNumber({ label, value, onChange }:{
  label:string; value:string; onChange:(v:string)=>void;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input className="input" inputMode="decimal" value={value} onChange={(e)=>onChange(e.target.value)} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }:{
  label:string; value:string; onChange:(v:string)=>void; options:string[];
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e)=>onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    </div>
  );
}

const FIXED_TENDENCIA = ["Alcista","Bajista","Lateral"];
const FIXED_SESION = ["Sydney","Tokyo","London","New York","After-Hours"];
const FIXED_SIGNAL = ["BUY","SELL"];
const FIXED_SIDE = ["BUY","SELL"];
const FIXED_CLOSE = ["User","SL","TP"];
// [E1] — OPCIONES FIJAS: Emociones (no editables)
const FIXED_EMOCIONES = [
  // Positivas
  "Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción",
  // Negativas
  "Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo",
];


function numOrEmpty(n:number|null){ return (n===null||n===undefined) ? "" : String(n); }
function strOrNum(s:string){ const v=Number(s); return Number.isNaN(v)? null : v; }
export default function TradeEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [uid, setUid] = useState<string>("");
  const [f, setF] = useState<Trade | null>(null);
  const [saving, setSaving] = useState(false);

  // Catálogos (desde /field-edits)
  const { symbols, timeframes, eas, patterns, candles, loading: loadingCats, error: catsError } = useCatalogOptions();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUid(auth.user.id);
      const { data, error } = await supabase.from("trades").select("*").eq("id", Number(params.id)).maybeSingle();
      if (error) { alert("Error cargando trade: " + error.message); return; }
      setF(data as Trade);
    })();
  }, [params.id, router]);

  const bitlogId = useMemo(()=> f?.id ?? Number(params.id), [f, params.id]);

  function set<K extends keyof Trade>(k: K, v: Trade[K]) {
    setF(prev => prev ? { ...prev, [k]: v } : prev);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    if (!f.ticket || f.ticket.trim() === "") { alert("Ticket es requerido"); return; }
    setSaving(true);
    try {
      const payload = { ...f };
      const { error } = await supabase.from("trades").update(payload).eq("id", f.id);
      if (error) throw error;
      router.push(`/trades/${f.id}`);
    } catch (err:any) {
      alert("Error al guardar: " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  if (!f) {
    return (
      <div className="container">
        <div id="topnav-placeholder"></div>
        <div className="card"><p>Cargando…</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div id="topnav-placeholder"></div>

      <div className="card">
        <div className="head-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div>
            <h1 className="title">Editar Trade #{f.ticket ?? f.id} / <span style={{opacity:.8}}>Bitlog ID: #{bitlogId}</span></h1>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <a className="btn secondary" href={`/trades/${f.id}`}>Cancelar</a>
            <button className="btn" onClick={onSubmit} disabled={saving || loadingCats}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>

        {catsError ? <div className="alert error">Error cargando catálogos: {String(catsError)}</div> : null}

        <form onSubmit={onSubmit}>
          {/* Bloque 1: Superiores */}
          <div className="grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FieldText    label="Ticket"    value={f.ticket ?? ""} onChange={(v)=>set("ticket", v)} required />

            <FieldSelect  label="Lado"      value={f.side ?? ""} onChange={(v)=>set("side", (v||null) as any)} options={FIXED_SIDE} />

            <FieldSelect  label="Símbolo"   value={f.symbol ?? ""} onChange={(v)=>set("symbol", v||null)} options={symbols} />
            <FieldSelect  label="Timeframe" value={f.timeframe ?? ""} onChange={(v)=>set("timeframe", v||null)} options={timeframes} />

            <FieldSelect  label="Sesión"    value={f.session ?? ""} onChange={(v)=>set("session", (v||null) as any)} options={FIXED_SESION} />
            <FieldSelect  label="Tendencia" value={f.tendencia ?? ""} onChange={(v)=>set("tendencia", (v||null) as any)} options={FIXED_TENDENCIA} />
            {/* [E2] — Emoción (dropdown fijo) */}
            <FieldSelect
                label="Emoción"
                value={f.emocion ?? ""}
                onChange={(v)=>set("emocion", (v || null) as any)}
                options={FIXED_EMOCIONES}
            />
            <FieldSelect  label="Close Reason" value={f.close_reason ?? ""} onChange={(v)=>set("close_reason", (v||null) as any)} options={FIXED_CLOSE} />

          </div>

          {/* Bloque 2: Precios/P&L */}
          <div className="grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            <FieldNumber label="Precio de Apertura" value={numOrEmpty(f.entry_price)} onChange={(v)=>set("entry_price", strOrNum(v))} />
            <FieldNumber label="Precio de Cierre"   value={numOrEmpty(f.exit_price)} onChange={(v)=>set("exit_price", strOrNum(v))} />
            <FieldNumber label="Volumen"            value={numOrEmpty(f.volume)} onChange={(v)=>set("volume", strOrNum(v))} />
            <FieldNumber label="$P&L"               value={numOrEmpty(f.pnl_usd_gross)} onChange={(v)=>set("pnl_usd_gross", strOrNum(v))} />
          </div>

          {/* Bloque 3: Patrón / Vela / R */}
          <div className="grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            <FieldSelect  label="Patrón"   value={f.patron ?? ""} onChange={(v)=>set("patron", v||null)} options={patterns} />
            <FieldSelect  label="Vela"     value={f.vela ?? ""} onChange={(v)=>set("vela", v||null)} options={candles} />
            <FieldNumber  label="Pips"     value={numOrEmpty(f.pips)} onChange={(v)=>set("pips", strOrNum(v))} />
            <FieldText    label="R objetivo" value={f.rr_objetivo ?? ""} onChange={(v)=>set("rr_objetivo", v)} />
          </div>

          {/* Bloque 4: EA */}
          <div className="grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            <FieldSelect  label="EA"         value={f.ea ?? ""} onChange={(v)=>set("ea", v||null)} options={eas} />
            <FieldSelect  label="Señal (EA)" value={f.ea_signal ?? ""} onChange={(v)=>set("ea_signal", (v||null) as any)} options={FIXED_SIGNAL} />
            <FieldNumber  label="Calificación (EA)" value={numOrEmpty(f.ea_score)} onChange={(v)=>set("ea_score", strOrNum(v))} />
            <FieldText    label="TP1" value={f.ea_tp1 ?? ""} onChange={(v)=>set("ea_tp1", v)} />
            <FieldText    label="TP2" value={f.ea_tp2 ?? ""} onChange={(v)=>set("ea_tp2", v)} />
            <FieldText    label="TP3" value={f.ea_tp3 ?? ""} onChange={(v)=>set("ea_tp3", v)} />
            <FieldText    label="SL1" value={f.ea_sl1 ?? ""} onChange={(v)=>set("ea_sl1", v)} />
          </div>

         
          {/* Notas */}
          <div className="field" style={{ marginTop:12 }}>
            <label className="label">Notas</label>
            <textarea className="input" style={{ minHeight:90 }} value={f.notes ?? ""} onChange={(e)=>set("notes", e.target.value)} />
          </div>

          {/* ImageManager editable */}
          <div className="field" style={{ marginTop:16 }}>
            <label className="label">Imágenes</label>
            <ImageManager tradeId={f.id} userId={uid} />
          </div>

          <div className="btn-row" style={{ marginTop:12 }}>
            <a className="btn secondary" href={`/trades/${f.id}`}>Cancelar</a>
            <button className="btn" type="submit" disabled={saving || loadingCats}>{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}




