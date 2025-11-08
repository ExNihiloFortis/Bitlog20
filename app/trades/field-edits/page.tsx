// ===================== [5A] /field-edits/page.tsx =====================
// [5A.1] Usa columnas: id, type, value, sort_index en catalog_items.
// - Si no existen, aplica el SQL [5B].
// ======================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import TopNav from "@/components/TopNav";

type CatType = "symbol" | "timeframe" | "ea" | "pattern" | "candle";
type CatRow = { id: number; value: string; sort_index: number | null };

const TABS: { key: CatType; title: string; hint: string }[] = [
  { key: "symbol",    title: "Símbolos",   hint: "EURUSD, BTCUSD, XAUUSD, etc." },
  { key: "timeframe", title: "Timeframes", hint: "M5, M15, H1, H4, D1" },
  { key: "ea",        title: "EAs",        hint: "WaveEMAs, Hold5%, etc." },
  { key: "pattern",   title: "Patrones",   hint: "Pin bar, Engulfing, etc." },
  { key: "candle",    title: "Velas",      hint: "Doji, Hammer, Shooting Star, etc." },
];

const EMOCIONES_POS = ["Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción"];
const EMOCIONES_NEG = ["Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo"];

export default function FieldEditsPage() {
  const sb = useMemo(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [active, setActive] = useState<CatType>("symbol");
  const [rows, setRows]     = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState(false);
  const [newValue, setNewValue] = useState("");

  const canAdd = useMemo(() => !!newValue.trim() && !adding && !loading, [newValue, adding, loading]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await sb
          .from("catalog_items")
          .select("id,value,sort_index")
          .eq("type", active)
          .order("sort_index", { ascending: true })
          .order("value", { ascending: true });
        if (error) throw error;
        setRows((data || []) as CatRow[]);
      } catch (e: any) {
        alert("Error al cargar catálogo: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [active, sb]);

  async function addItem() {
    if (!canAdd) return;
    setAdding(true);
    try {
      const next = (rows.reduce((m, r) => Math.max(m, r.sort_index ?? 0), -1) + 1) || 0;
      const { data, error } = await sb
        .from("catalog_items")
        .insert({ type: active, value: newValue.trim(), sort_index: next })
        .select("id,value,sort_index")
        .single();
      if (error) throw error;
      setRows(prev => [...prev, data as any].sort((a,b)=>(a.sort_index??0)-(b.sort_index??0)));
      setNewValue("");
    } catch (e: any) {
      alert("Error al añadir: " + e.message);
    } finally {
      setAdding(false);
    }
  }

  async function delItem(id: number) {
    if (!confirm("¿Borrar este valor?")) return;
    try {
      const { error } = await sb.from("catalog_items").delete().eq("id", id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert("No se pudo borrar: " + e.message);
    }
  }

  return (
    <>
      <TopNav />
      <div className="page-center">
        <div className="form-card">
          <div className="form-head">
            <div className="form-title">Editor de Catálogos</div>
            <span className="badge">/field-edits</span>
          </div>

          <div className="tabs" style={{ margin: "8px 0 14px 0" }}>
            {TABS.map((t) => (
              <button key={t.key} type="button" className={`tab ${active === t.key ? "active" : ""}`} onClick={() => setActive(t.key)}>
                {t.title}
              </button>
            ))}
            <button type="button" className="tab" disabled style={{ marginLeft: 6, opacity: 0.7 }}>Emociones (fijas)</button>
          </div>

          <div className="form-body">
            <div className="grid-3">
              <div className="field" style={{ gridColumn: "1 / span 2" }}>
                <label className="label">{TABS.find(t=>t.key===active)?.title} (editable)</label>
                <div className="hint" style={{ marginBottom: 6 }}>{TABS.find(t=>t.key===active)?.hint}</div>

                <div className="list">
                  {loading && <div className="hint">Cargando…</div>}
                  {!loading && rows.length === 0 && <div className="hint">Sin elementos todavía.</div>}
                  {!loading && rows.map(r=>(
                    <div key={r.id} className="list-row">
                      <div className="list-value">{r.value}</div>
                      <div className="list-actions">
                        <button className="btn danger" type="button" onClick={()=>delItem(r.id)}>Borrar</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="btn-row" style={{ marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="Nuevo valor…"
                    value={newValue}
                    onChange={(e)=>setNewValue(e.target.value)}
                    onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); if(canAdd) addItem(); } }}
                  />
                  <button className="btn" type="button" disabled={!canAdd} onClick={addItem}>
                    {adding ? "Añadiendo…" : "Añadir"}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="label">Emociones (NO editables)</label>
                <div className="subhead">Positivas</div>
                <ul className="chip-list">{EMOCIONES_POS.map(e=><li key={e} className="chip">{e}</li>)}</ul>
                <div className="subhead" style={{ marginTop: 10 }}>Negativas</div>
                <ul className="chip-list">{EMOCIONES_NEG.map(e=><li key={e} className="chip">{e}</li>)}</ul>
                <div className="hint" style={{ marginTop: 8 }}>Se usan como dropdown fijo en los formularios.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

