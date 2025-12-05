// ===================== [C1] Página Checklist EAs =====================
// /checklist
// - Selector de EA (WavesEMAS / R/R-EMA-100/200)
// - Checklists dinámicos (confluencias) por EA
// - Estado por día + EA guardado en localStorage
// - Bloque de manual con scroll, mismo ancho visual que /trades/new
// - Manuales cargados desde /public/manuales/*.txt
// ====================================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";

// ===================== [C2] Tipos básicos =====================
type EAKey = "WavesEMAS" | "RR_EMA100_200";

type ChecklistItem = {
  id: string;
  label: string;
  group: "obligatorias" | "refuerzo" | "descalificadores";
};

// ===================== [C3] Checklist — WavesEMAS =====================
// Versión compacta basada en tu checklist oficial V3.0
const WAVES_ITEMS: ChecklistItem[] = [
  // Obligatorias (AAA)
  {
    id: "waves_trend_emas",
    label: "Tendencia EMAs: BUY = EMA7 > EMA20 > EMA50; SELL = EMA7 < EMA20 < EMA50",
    group: "obligatorias",
  },
  {
    id: "waves_body_vs_atr",
    label: "Cuerpo fuerte (≥ 1.20 × ATR normalizado)",
    group: "obligatorias",
  },
  {
    id: "waves_no_wick_against",
    label: "Sin mecha fuerte contra la tendencia tocando EMA7",
    group: "obligatorias",
  },
  {
    id: "waves_zone_ok",
    label: "Zona válida: Fibo (0.382–0.618) o SR o BOS simple",
    group: "obligatorias",
  },
  {
    id: "waves_room_atr",
    label: "Espacio suficiente: room ≥ 1.0 × ATR",
    group: "obligatorias",
  },
  {
    id: "waves_energy",
    label: "Energía (ATR percentil) ≥ 40% (≥ 70% ideal)",
    group: "obligatorias",
  },
  {
    id: "waves_spread_ok",
    label: "Spread razonable (≤ 1.0 × ATR; si > 1.5× ATR = NO)",
    group: "obligatorias",
  },

  // Refuerzo
  {
    id: "waves_micro_structure",
    label: "Microestructura coherente: BUY = HL–HL–HL / SELL = LH–LH–LH",
    group: "refuerzo",
  },
  {
    id: "waves_intent_candle",
    label: "Vela de intención fuerte (Engulfing / Marubozu / sólida)",
    group: "refuerzo",
  },
  {
    id: "waves_not_range",
    label: "Mercado NO está en rango de 5–10 velas pequeñas",
    group: "refuerzo",
  },
  {
    id: "waves_no_news",
    label: "No hay noticias fuertes cerca (±5 minutos)",
    group: "refuerzo",
  },
  {
    id: "waves_volume_up",
    label: "Volumen creciente (cripto/índices)",
    group: "refuerzo",
  },

  // Descalificadores
  {
    id: "waves_bad_wick",
    label: "Mecha larga en contra de la dirección",
    group: "descalificadores",
  },
  {
    id: "waves_flat_emas",
    label: "EMAs planas o mezcladas (sin tendencia real)",
    group: "descalificadores",
  },
  {
    id: "waves_weak_signal_candle",
    label: "Doji, pinbar o vela débil como señal de entrada",
    group: "descalificadores",
  },
  {
    id: "waves_room_too_small",
    label: "Espacio < 1 ATR (precio atrapado)",
    group: "descalificadores",
  },
  {
    id: "waves_low_atr",
    label: "ATR bajo (mercado muerto)",
    group: "descalificadores",
  },
  {
    id: "waves_high_spread",
    label: "Spread alto (> 1.5× ATR)",
    group: "descalificadores",
  },
  {
    id: "waves_clear_range",
    label: "Rango lateral evidente",
    group: "descalificadores",
  },
];

// ===================== [C4] Checklist — R/R EMA 100/200 =====================
// Basado en tu checklist oficial de Rebote/Rompimiento EMA100/200
const RR_ITEMS: ChecklistItem[] = [
  // Rebote — obligatorias
  {
    id: "rr_rebote_slope",
    label: "Rebote: EMA100/200 con pendiente definida (no planas)",
    group: "obligatorias",
  },
  {
    id: "rr_rebote_touch",
    label: "Rebote: Toque real a la EMA (mecha/cuerpo, no 'casi')",
    group: "obligatorias",
  },
  {
    id: "rr_rebote_rejection",
    label: "Rebote: Vela de rechazo limpia (mecha en EMA + cierre lejos)",
    group: "obligatorias",
  },
  {
    id: "rr_rebote_confirm",
    label: "Rebote: Vela de confirmación fuerte (Engulfing/Marubozu/Hammer/Shooting Star)",
    group: "obligatorias",
  },

  // Rebote — refuerzo
  {
    id: "rr_rebote_structure",
    label: "Rebote: Estructura previa sana (BUY: HL–HL–HL / SELL: LH–LH–LH)",
    group: "refuerzo",
  },
  {
    id: "rr_rebote_volume",
    label: "Rebote: Volumen de apoyo en rechazo o confirmación",
    group: "refuerzo",
  },
  {
    id: "rr_rebote_distance",
    label: "Rebote: Gran distancia previa del precio a la EMA",
    group: "refuerzo",
  },
  {
    id: "rr_rebote_first_touch",
    label: "Rebote: Primer toque en > 30 velas",
    group: "refuerzo",
  },
  {
    id: "rr_rebote_sd",
    label: "Rebote: Confluencia con zona de oferta/demanda (SD)",
    group: "refuerzo",
  },

  // Rompimiento — obligatorias
  {
    id: "rr_break_close_outside",
    label: "Rompimiento: Cierre completo fuera de la EMA100/200",
    group: "obligatorias",
  },
  {
    id: "rr_break_body",
    label: "Rompimiento: Cuerpo fuerte de expansión (vela sólida)",
    group: "obligatorias",
  },
  {
    id: "rr_break_small_opposite_wick",
    label: "Rompimiento: Wick opuesta pequeña (< 25% de la vela)",
    group: "obligatorias",
  },
  {
    id: "rr_break_volume",
    label: "Rompimiento: Volumen alto acompañando el quiebre",
    group: "obligatorias",
  },

  // Rompimiento — refuerzo
  {
    id: "rr_break_retest",
    label: "Rompimiento: Retesteo limpio a la zona de EMA (sin meterse del otro lado)",
    group: "refuerzo",
  },
  {
    id: "rr_break_bos",
    label: "Rompimiento: Break of Structure (BOS) real (nivel importante)",
    group: "refuerzo",
  },
  {
    id: "rr_break_follow_through",
    label: "Rompimiento: Continuación posterior (2ª vela o inside bar que rompe a favor)",
    group: "refuerzo",
  },
  {
    id: "rr_break_slope",
    label: "Rompimiento: Pendiente fuerte de la EMA antes del quiebre",
    group: "refuerzo",
  },
  {
    id: "rr_break_fvg",
    label: "Rompimiento: FVG reciente a favor del movimiento",
    group: "refuerzo",
  },

  // Descalificadores globales (rebote/rompimiento)
  {
    id: "rr_bad_flat_emas",
    label: "EMAs planas / EMA100 y EMA200 muy juntas (rango, no tendencia)",
    group: "descalificadores",
  },
  {
    id: "rr_bad_huge_opposite",
    label: "Vela enorme en contra justo antes del toque/rompimiento",
    group: "descalificadores",
  },
  {
    id: "rr_bad_indecision",
    label: "Muchas mechas en ambos lados o consolidación prolongada en la zona",
    group: "descalificadores",
  },
  {
    id: "rr_bad_news",
    label: "Noticias de alto impacto muy cerca",
    group: "descalificadores",
  },
];

// ===================== [C5] Rutas de manuales =====================
// Se leen desde /public/manuales/*.txt (editables sin tocar código)
const MANUAL_PATHS: Record<EAKey, string> = {
  WavesEMAS: "/manuales/Manual-de-WavesEMAS.txt",
  RR_EMA100_200: "/manuales/Manual-del-EA-RR-EMA100-200.txt",
};

// ===================== [C6] Utils — Storage key =====================
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildStorageKey(ea: EAKey): string {
  const day = getTodayKey();
  return `bitlog_checklist_v1_${ea}_${day}`;
}

// ===================== [C7] Componente principal =====================
export default function ChecklistPage() {
  const [selectedEA, setSelectedEA] = useState<EAKey>("WavesEMAS");

  // Estado de checks para el EA actual (por día)
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  // Texto del manual cargado desde el .txt
  const [manualText, setManualText] = useState<string>("Cargando manual...");

  // Cargar estado de checkboxes desde localStorage cuando cambia EA
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = buildStorageKey(selectedEA);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setCheckedMap({});
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setCheckedMap(parsed as Record<string, boolean>);
      } else {
        setCheckedMap({});
      }
    } catch {
      setCheckedMap({});
    }
  }, [selectedEA]);

  // Persistir checkboxes al cambiar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = buildStorageKey(selectedEA);
    window.localStorage.setItem(key, JSON.stringify(checkedMap));
  }, [checkedMap, selectedEA]);

  // Cargar manual desde /public/manuales/*.txt al cambiar EA
  useEffect(() => {
    const path = MANUAL_PATHS[selectedEA];
    setManualText("Cargando manual...");
    fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar el manual");
        return res.text();
      })
      .then((txt) => {
        setManualText(txt);
      })
      .catch(() => {
        setManualText("No se pudo cargar el manual. Revisa los archivos en /public/manuales.");
      });
  }, [selectedEA]);

  // Ítems activos + título
  const { items, title } = useMemo(() => {
    if (selectedEA === "WavesEMAS") {
      return {
        items: WAVES_ITEMS,
        title: "Checklist — EA WavesEMAS",
      };
    }
    return {
      items: RR_ITEMS,
      title: "Checklist — Rebote/Rompimiento EMA100/200",
    };
  }, [selectedEA]);

  const handleToggle = (id: string) => {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReset = () => {
    if (!window.confirm("¿Resetear checklist para este EA y este día?")) return;
    setCheckedMap({});
    if (typeof window !== "undefined") {
      const key = buildStorageKey(selectedEA);
      window.localStorage.removeItem(key);
    }
  };

  const obligatorias = items.filter((i) => i.group === "obligatorias");
  const refuerzo = items.filter((i) => i.group === "refuerzo");
  const descalificadores = items.filter((i) => i.group === "descalificadores");

  return (
    <>
      <TopNav />
      <div className="page-center">
        <div className="form-card">
          {/* ===================== [C8] Header ===================== */}
          <div className="form-head">
            <div className="form-title">Checklist de Confluencias</div>
            <span className="badge">/checklist</span>
          </div>

          {/* ===================== [C9] Selector de EA + meta ===================== */}
          <div className="form-body">
            <div className="field">
              <label className="label">Elegir EA</label>
              <select
                className="select"
                value={selectedEA}
                onChange={(e) => setSelectedEA(e.target.value as EAKey)}
              >
                <option value="WavesEMAS">WavesEMAS</option>
                <option value="RR_EMA100_200">Rebote/Rompimiento EMA100/200</option>
              </select>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                Día: {getTodayKey()} — Estado se guarda por EA y por día en este dispositivo.
              </div>
            </div>

            {/* ===================== [C10] Bloque de checklists ===================== */}
            <div style={{ marginTop: 16 }}>
              <h2 className="label" style={{ marginBottom: 8 }}>
                {title}
              </h2>

              {/* Obligatorias */}
              {obligatorias.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    className="label"
                    style={{ fontSize: 14, marginBottom: 6 }}
                  >
                    Confluencias obligatorias (AAA)
                  </div>
                  <div>
                    {obligatorias.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 6,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedMap[item.id]}
                          onChange={() => handleToggle(item.id)}
                          style={{ marginTop: 2 }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Refuerzo */}
              {refuerzo.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    className="label"
                    style={{ fontSize: 14, marginBottom: 6 }}
                  >
                    Confluencias de refuerzo (suben probabilidad)
                  </div>
                  <div>
                    {refuerzo.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 6,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedMap[item.id]}
                          onChange={() => handleToggle(item.id)}
                          style={{ marginTop: 2 }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Descalificadores */}
              {descalificadores.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    className="label"
                    style={{ fontSize: 14, marginBottom: 6 }}
                  >
                    Descalificadores automáticos
                  </div>
                  <div>
                    {descalificadores.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 6,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedMap[item.id]}
                          onChange={() => handleToggle(item.id)}
                          style={{ marginTop: 2 }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón reset */}
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleReset}
                >
                  Reset checklist (EA actual, día actual)
                </button>
              </div>
            </div>

            {/* ===================== [C11] Bloque Manual con scroll ===================== */}
            <div style={{ marginTop: 24 }}>
              <div className="label" style={{ marginBottom: 6 }}>
                Manual / Referencia del EA
              </div>
              <div
                style={{
                  maxHeight: 360,
                  overflowY: "auto",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.6)",
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                }}
              >
                {manualText}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

