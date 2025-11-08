// ===================== [/field-edits/page.tsx] =====================
// [B1] OBJETIVO
// - Pantalla de edición de catálogos con el MISMO estilo que /trades (page-center, form-card…).
// - Soporta: symbols, timeframes, ea, pattern, candle (CRUD básico).
// - Usa columna `value` (NO `label`) para evitar el error de schema.
// - Botón de borrar para cada renglón; añadir con validación mínima.
// - Emociones: bloque NO editable con la lista prefijada que pediste.
// ===================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CatType = "symbol" | "timeframe" | "ea" | "pattern" | "candle";
type CatRow = { id: number; value: string; sort_index: number | null };

const TABS: { key: CatType; title: string; hint: string }[] = [
  { key: "symbol",    title: "Símbolos",   hint: "EURUSD, BTCUSD, XAUUSD, etc." },
  { key: "timeframe", title: "Timeframes", hint: "M5, M15, H1, H4, D1" },
  { key: "ea",        title: "EAs",        hint: "WaveEMAs, Hold5%, etc." },
  { key: "pattern",   title: "Patrones",   hint: "Pin bar, Engulfing, etc." },
  { key: "candle",    title: "Velas",      hint: "Doji, Hammer, Shooting Star, etc." },
];

// Emociones fijas (NO editables)
const EMOCIONES_POS = [
  "Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción",
];
const EMOCIONES_NEG = [
  "Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo",
];

export default function FieldEditsPage() {
  // ---------- [B2] Estado ----------
  const [active, setActive] = useState<CatType>("symbol");
  const [rows, setRows]     = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState(false);
  const [newValue, setNewValue] = useState("");

  const canAdd = useMemo(
    () => !!newValue.trim() && !adding && !loading,
    [newValue, adding, loading]
  );

  // ---------- [B3] Cargar catálogos por pestaña ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setRows([]);
      try {
        const { data, error } = await supabase
          .from("catalog_items")
          .select("id,value,sort_index")
          .eq("type", active)
          .order("sort_index", { ascending: true })
          .order("value", { ascending: true, nullsFirst: false });

        if (error) throw error;
        setRows((data || []) as CatRow[]);
      } catch (err: any) {
        console.error(err);
        alert("Error al cargar catálogo: " + (err?.message ?? String(err)));
      } finally {
        setLoading(false);
      }
    })();
  }, [active]);

  // ---------- [B4] Añadir ----------
  const addItem = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      const value = newValue.trim();

      // sort_index: siguiente número
      const nextIndex =
        rows.reduce((max, r) => Math.max(max, r.sort_index ?? 0), -1) + 1;

      const { data, error } = await supabase
        .from("catalog_items")
        .insert({ type: active, value, sort_index: nextIndex })
        .select("id,value,sort_index")
        .single();

      if (error) throw error;
      setRows((old) => [...old, data as CatRow].sort(bySortThenValue));
      setNewValue("");
    } catch (err: any) {
      console.error(err);
      alert("Error al añadir: " + (err?.message ?? String(err)));
    } finally {
      setAdding(false);
    }
  };

  // ---------- [B5] Borrar ----------
  const delItem = async (row: CatRow) => {
    if (!confirm(`¿Borrar "${row.value}"?`)) return;
    try {
      const { error } = await supabase.from("catalog_items").delete().eq("id", row.id);
      if (error) throw error;
      setRows((old) => old.filter((r) => r.id !== row.id));
    } catch (err: any) {
      console.error(err);
      alert("No se pudo borrar: " + (err?.message ?? String(err)));
    }
  };

  // ---------- [B6] Helpers ----------
  function bySortThenValue(a: CatRow, b: CatRow) {
    const ai = a.sort_index ?? 0;
    const bi = b.sort_index ?? 0;
    if (ai !== bi) return ai - bi;
    return a.value.localeCompare(b.value);
  }

  // ---------- [B7] UI ----------
  return (
    <div className="page-center">
      <div className="form-card">
        {/* Header */}
        <div className="form-head">
          <div className="form-title">Editor de Catálogos</div>
          <span className="badge">/field-edits</span>
        </div>

        {/* Tabs */}
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
          <button
            type="button"
            className={`tab ${false ? "active" : ""}`}
            disabled
            style={{ marginLeft: 6, opacity: 0.7 }}
            title="Listado solo informativo"
          >
            Emociones (fijas)
          </button>
        </div>

        {/* Body */}
        <div className="form-body">
          {/* Columna izquierda: CRUD del tipo activo */}
          <div className="grid-3">
            <div className="field" style={{ gridColumn: "1 / span 2" }}>
              <label className="label">
                {TABS.find((t) => t.key === active)?.title} (editable)
              </label>

              <div className="hint" style={{ marginBottom: 6 }}>
                {TABS.find((t) => t.key === active)?.hint}
              </div>

              {/* Lista */}
              <div className="list">
                {loading && <div className="hint">Cargando…</div>}
                {!loading && rows.length === 0 && (
                  <div className="hint">Sin elementos todavía.</div>
                )}
                {!loading &&
                  rows.map((r) => (
                    <div key={r.id} className="list-row">
                      <div className="list-value">{r.value}</div>
                      <div className="list-actions">
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => delItem(r)}
                          title="Borrar"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Añadir */}
              <div className="btn-row" style={{ marginTop: 10 }}>
                <input
                  className="input"
                  placeholder="Nuevo valor…"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (canAdd) addItem();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!canAdd}
                  onClick={addItem}
                >
                  {adding ? "Añadiendo…" : "Añadir"}
                </button>
              </div>
            </div>

            {/* Columna derecha: emociones fijas */}
            <div className="field">
              <label className="label">Emociones (NO editables)</label>


              {/*<div className="subhead">Positivas</div>
              <ul className="chip-list">
                {EMOCIONES_POS.map((e) => (
                  <li key={e} className="chip">{e}</li>
                ))}
              </ul>

              <div className="subhead" style={{ marginTop: 10 }}>Negativas</div>
              <ul className="chip-list">
                {EMOCIONES_NEG.map((e) => (
                  <li key={e} className="chip">{e}</li>
                ))}
              </ul>

              <div className="hint" style={{ marginTop: 8 }}>
                Este listado es informativo; se usa como dropdown fijo en otras pantallas.
              </div>*/}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// =================== [FIN /field-edits/page.tsx] ===================

