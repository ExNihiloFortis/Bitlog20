// ===================== [/app/field-edits/page.tsx] =====================
// [FE-1] Editor de catálogos con dropdowns ordenados (alfabético).
// - Soporta: symbol, timeframe, ea, pattern, candle, fake_source, fake_source_type.
// - Ver/borrar mediante <select>, añadir con input.
// - Evita duplicados (check en UI + captura de 23505 si hay UNIQUE).
// - Misma estética que /trades (page-center, form-card, badges).
// =======================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

type CatType = "symbol" | "timeframe" | "ea" | "pattern" | "candle" | "fake_source" | "fake_source_type";
type CatRow = { id: number; value: string; sort_index: number | null };

const TABS: { key: CatType; title: string; hint: string }[] = [
  { key: "symbol",    title: "Símbolos",   hint: "EURUSD, BTCUSD, XAUUSD, AAPL, NVDA, etc." },
  { key: "timeframe", title: "Timeframes", hint: "M5, M15, H1, H4, D1" },
  { key: "ea",        title: "EAs / IA / Modelo", hint: "WaveEMAs, ChatGPT, Claude, Gemini, Grok, etc." },
  { key: "pattern",   title: "Patrones",   hint: "Pin Bar, Engulfing, Bull Flag, Double Bottom, etc." },
  { key: "candle",    title: "Velas",      hint: "Doji, Hammer, Marubozu, Shooting Star, etc." },
  { key: "fake_source",      title: "Fuentes Fake",      hint: "TradingView, Finviz, X, Discord, Reddit, Seeking Alpha, Investing.com, etc." },
  { key: "fake_source_type", title: "Tipos fuente Fake", hint: "IA, Plataforma, Red social, Comunidad, Screener, Noticias, Video, etc." },
];

// Emociones fijas (NO editables). En Fake Trades no se usan; se conservan para Real Trades.
const EMO_POS = ["Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción"];
const EMO_NEG = ["Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo"];

export default function FieldEditsPage() {
  const [active, setActive] = useState<CatType>("symbol");
  const [rows, setRows] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const options = useMemo(
    () => [...rows].sort((a,b)=> a.value.localeCompare(b.value)),
    [rows]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setRows([]);
      setSelectedId(null);
      try {
        const { data, error } = await supabase
          .from("catalog_items")
          .select("id,value,sort_index")
          .eq("type", active)
          .order("value", { ascending: true });
        if (error) throw error;
        setRows((data || []) as CatRow[]);
      } catch (err: any) {
        alert("Error al cargar catálogo: " + (err?.message ?? String(err)));
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  async function onAdd() {
    const value = newValue.trim();
    if (!value) return;

    if (rows.some(r => r.value.toLowerCase() === value.toLowerCase())) {
      alert(`"${value}" ya existe en ${active}.`);
      return;
    }

    setWorking(true);
    try {
      const nextIndex = rows.reduce((m, r) => Math.max(m, r.sort_index ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from("catalog_items")
        .insert({ type: active, value, sort_index: nextIndex })
        .select("id,value,sort_index")
        .single();

      if (error) throw error;
      setRows(prev => [...prev, data as CatRow]);
      setNewValue("");
    } catch (err: any) {
      if (String(err?.message || err).includes("duplicate key value") || String(err?.code) === "23505") {
        alert(`"${value}" ya existe en ${active}.`);
      } else {
        alert("Error al añadir: " + (err?.message ?? String(err)));
      }
    } finally {
      setWorking(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    const row = rows.find(r => r.id === selectedId);
    if (!row) return;
    if (!confirm(`¿Borrar "${row.value}"?`)) return;

    setWorking(true);
    try {
      const { error } = await supabase.from("catalog_items").delete().eq("id", selectedId);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== selectedId));
      setSelectedId(null);
    } catch (err: any) {
      alert("No se pudo borrar: " + (err?.message ?? String(err)));
    } finally {
      setWorking(false);
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
              <button
                key={t.key}
                type="button"
                className={`tab ${active === t.key ? "active" : ""}`}
                onClick={() => setActive(t.key)}
              >
                {t.title}
              </button>
            ))}
            <button type="button" className="tab" disabled style={{ marginLeft: 6, opacity: 0.7 }}>
              Emociones (fijas)
            </button>
          </div>

          <div className="form-body">
            <div className="grid-3">
              <div className="field" style={{ gridColumn: "1 / span 2" }}>
                <label className="label">
                  {TABS.find(t=>t.key===active)?.title} (dropdown)
                </label>
                <div className="hint" style={{ marginBottom: 6 }}>
                  {TABS.find(t=>t.key===active)?.hint}
                </div>

                <select
                  className="select"
                  size={8}
                  value={selectedId ?? ""}
                  onChange={(e)=> setSelectedId(Number(e.target.value) || null)}
                  disabled={loading}
                >
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.value}</option>
                  ))}
                </select>

                <div className="btn-row" style={{ marginTop: 10 }}>
                  <input
                    className="input"
                    placeholder="Nuevo valor…"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e)=>{
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAdd();
                      }
                    }}
                    disabled={working || loading}
                  />
                  <button className="btn" type="button" onClick={onAdd} disabled={working || loading || !newValue.trim()}>
                    {working ? "Guardando…" : "Añadir"}
                  </button>
                  <button className="btn danger" type="button" onClick={onDelete} disabled={working || loading || !selectedId}>
                    Borrar seleccionado
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="label">Emociones (NO editables)</label>
                <div className="subhead">Positivas</div>
                <ul className="chip-list">
                  {EMO_POS.map(e => <li key={e} className="chip">{e}</li>)}
                </ul>
                <div className="subhead" style={{ marginTop: 10 }}>Negativas</div>
                <ul className="chip-list">
                  {EMO_NEG.map(e => <li key={e} className="chip">{e}</li>)}
                </ul>
                <div className="hint" style={{ marginTop: 8 }}>
                  Esta lista alimenta el dropdown fijo en /trades/new y /trades/[id]/edit. Fake Trades usa fuentes, no emociones.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// =================== [FIN /app/field-edits/page.tsx] ===================
