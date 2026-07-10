"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/components/TopNav";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

/* ===================== Tipos ===================== */

type FakeTradeRow = {
  id: number;
  symbol: string | null;
  side: string | null;
  timeframe: string | null;
  setup_datetime: string | null;
  target_date: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
  pattern_name: string | null;
  candle_name: string | null;
  ea: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  tp1: number | null;
  tp2: number | null;
  resistance: number | null;
  pivot: number | null;
  support: number | null;
  tendencia: string | null;
  session: string | null;
  rsi_value: number | null;
  stochastic_k: number | null;
  stochastic_d: number | null;
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  atr: number | null;
  adx: number | null;
  rvol: number | null;
  expected_move: string | null;
  failure_reason: string | null;
  lessons_learned: string | null;
  result: string | null;
  notes: string | null;
  created_at?: string | null;
};

type PerfRow = {
  key: string;
  parts: string[];
  trades: number;
  wins: number;
  losses: number;
  pending: number;
  neutral: number;
  winRate: number;
  expectancy: number;
  avgDaysToTarget: number | null;
  score: number;
};

type FilterPreset = {
  name: string;
  dateFrom: string;
  dateTo: string;
  sourceType: string;
  sourceName: string;
  symbol: string;
  tf: string;
  side: string;
  session: string;
  patron: string;
  vela: string;
  tendencia: string;
  ea: string;
  result: string;
  day: string;
  hour: string;
};

type DimensionKey =
  | "sourceType"
  | "sourceName"
  | "symbol"
  | "timeframe"
  | "session"
  | "day"
  | "hour"
  | "patron"
  | "vela"
  | "tendencia"
  | "ea"
  | "side"
  | "rsiZone"
  | "stochKZone"
  | "stochDZone"
  | "oscillatorConfluence"
  | "rvolZone"
  | "adxZone"
  | "emaContext";

type MetricKey = "winRate" | "expectancy" | "trades";

type SortDir = "asc" | "desc";

type MetricSortKey = "trades" | "wins" | "losses" | "pending" | "winRate" | "expectancy";

type SortState =
  | { colType: "part"; colIndex: number; dir: SortDir }
  | { colType: "metric"; metric: MetricSortKey; dir: SortDir }
  | null;

type DetailSortKey =
  | "id"
  | "symbol"
  | "timeframe"
  | "side"
  | "ea"
  | "session"
  | "sourceName"
  | "patron"
  | "vela"
  | "tendencia"
  | "setup"
  | "target"
  | "rsi"
  | "stochK"
  | "stochD"
  | "result";

/* ===================== Estilos (idénticos a page.tsx) ===================== */

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "#111",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 0 10px rgba(0,0,0,0.4)",
};

const TABLE_STYLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const TH_STYLE: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontWeight: 600,
  backgroundColor: "#000",
  color: "#ccc",
  borderBottom: "1px solid #333",
  userSelect: "none",
};

const TD_STYLE_BASE: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
};

const BADGE_STYLE_BASE: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};

const ICON_BTN_STYLE: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
  color: "#9ca3af",
  background: "transparent",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "3px 6px",
  userSelect: "none",
};

const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const NEUTRAL = "#737373";
const GRID = "#2a2a2a";
const AXIS = "#cfcfcf";

const DIMENSION_OPTIONS: [DimensionKey, string][] = [
  ["sourceType", "Tipo de fuente"],
  ["sourceName", "Fuente"],
  ["symbol", "Símbolo"],
  ["timeframe", "TF"],
  ["session", "Sesión"],
  ["day", "Día"],
  ["hour", "Hora"],
  ["patron", "Patrón"],
  ["vela", "Vela"],
  ["tendencia", "Tendencia"],
  ["ea", "EA"],
  ["side", "Dirección"],
  ["rsiZone", "Zona RSI"],
  ["stochKZone", "Zona Stoch K%"],
  ["stochDZone", "Zona Stoch D%"],
  ["oscillatorConfluence", "Confluencia RSI/Stoch"],
  ["rvolZone", "Zona RVOL"],
  ["adxZone", "Zona ADX"],
  ["emaContext", "Contexto EMAs"],
];

const DIMENSION_LABELS: Record<DimensionKey, string> = DIMENSION_OPTIONS.reduce(
  (acc, [k, l]) => {
    acc[k] = l;
    return acc;
  },
  {} as Record<DimensionKey, string>
);

const WEEKDAY_ORDER = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

type OscillatorThresholds = {
  rsiOversold: number;
  rsiOverbought: number;
  stochOversold: number;
  stochOverbought: number;
};

const DEFAULT_OSCILLATOR_THRESHOLDS: OscillatorThresholds = {
  rsiOversold: 30,
  rsiOverbought: 70,
  stochOversold: 20,
  stochOverbought: 80,
};

function normalizeThreshold(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/* ===================== Helpers de formato ===================== */

function safeNumber(n: number | null | undefined): number {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 0;
  return Number(n);
}

function fmtPct(p: number): string {
  if (!isFinite(p)) return "0%";
  return `${p.toFixed(1)}%`;
}

function fmtScore(n: number): string {
  if (!isFinite(n)) return "0";
  const sign = n >= 0 ? "" : "-";
  return `${sign}${Math.abs(n).toFixed(1)}`;
}

function fmtDateShort(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mazatlan",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDays(d: number | null): string {
  if (d === null || !isFinite(d)) return "—";
  if (d < 1) return `${(d * 24).toFixed(1)} h`;
  return `${d.toFixed(1)} d`;
}

function getTodayMazatlan(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function addDaysToDateString(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function getHourMazatlan(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Mazatlan",
  });
  const h = parseInt(formatter.format(d), 10);
  return Number.isNaN(h) ? 0 : h;
}

function getDayMazatlan(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "SIN_FECHA";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    timeZone: "America/Mazatlan",
  }).format(d);
}

/* ===================== Lógica de dominio (fake trades) ===================== */

function dateOf(t: FakeTradeRow): string | null {
  return t.setup_datetime || t.created_at || null;
}

function daysToTarget(t: FakeTradeRow): number | null {
  const a = dateOf(t);
  const b = t.target_date;
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db) || db < da) return null;
  return (db - da) / 86_400_000;
}

function resultKind(v: string | null | undefined): "WIN" | "LOSS" | "PENDING" | "NEUTRAL" {
  const s = (v || "PENDING").trim().toUpperCase();
  if (s.startsWith("SIN_") || s === "") return "PENDING";
  if (s.includes("WIN") || s.includes("TP") || s === "CUMPLIDO" || s === "SUCCESS") return "WIN";
  if (s.includes("LOSS") || s.includes("SL") || s === "FALLIDO" || s === "FAILED") return "LOSS";
  if (s.includes("PENDING") || s === "ABIERTO" || s === "OPEN") return "PENDING";
  if (s.includes("BE") || s.includes("NEUTRAL") || s === "BREAKEVEN") return "NEUTRAL";
  return "PENDING";
}

function getRsiZone(value: number | null | undefined, thresholds: OscillatorThresholds = DEFAULT_OSCILLATOR_THRESHOLDS): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "SIN_RSI";
  const n = Number(value);
  if (n < thresholds.rsiOversold) return "Sobreventa";
  if (n > thresholds.rsiOverbought) return "Sobrecompra";
  return "Neutral";
}

function getStochasticZone(value: number | null | undefined, thresholds: OscillatorThresholds = DEFAULT_OSCILLATOR_THRESHOLDS): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "SIN_STOCH";
  const n = Number(value);
  if (n < thresholds.stochOversold) return "Sobreventa";
  if (n > thresholds.stochOverbought) return "Sobrecompra";
  return "Neutral";
}

function getOscillatorConfluence(t: FakeTradeRow, thresholds: OscillatorThresholds = DEFAULT_OSCILLATOR_THRESHOLDS): string {
  const rsi = getRsiZone(t.rsi_value, thresholds);
  const stochK = getStochasticZone(t.stochastic_k, thresholds);
  if (rsi.startsWith("SIN_") || stochK.startsWith("SIN_")) return "SIN_CONFLUENCIA";
  return `RSI ${rsi} + Stoch K% ${stochK}`;
}

function getRvolZone(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "SIN_RVOL";
  const n = Number(v);
  if (n < 1) return "< 1";
  if (n < 1.5) return "1 – 1.49";
  if (n < 2) return "1.5 – 1.99";
  if (n < 3) return "2 – 2.99";
  return "≥ 3";
}

function getAdxZone(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "SIN_ADX";
  const n = Number(v);
  if (n < 20) return "< 20 sin tendencia";
  if (n < 25) return "20 – 24.99 débil";
  if (n < 40) return "25 – 39.99 fuerte";
  return "≥ 40 muy fuerte";
}

function getEmaContext(t: FakeTradeRow): string {
  const entry = t.entry_price;
  const e20 = t.ema20;
  const e50 = t.ema50;
  const e100 = t.ema100;
  const e200 = t.ema200;
  const parts: string[] = [];
  if (entry != null && e200 != null) parts.push(entry >= e200 ? "Precio ≥ EMA200" : "Precio < EMA200");
  if (e20 != null && e50 != null) parts.push(e20 >= e50 ? "EMA20 ≥ EMA50" : "EMA20 < EMA50");
  if (e50 != null && e100 != null) parts.push(e50 >= e100 ? "EMA50 ≥ EMA100" : "EMA50 < EMA100");
  if (e100 != null && e200 != null) parts.push(e100 >= e200 ? "EMA100 ≥ EMA200" : "EMA100 < EMA200");
  return parts.length ? parts.join(" | ") : "SIN_EMA";
}

function getTradeDimensionValue(t: FakeTradeRow, dim: DimensionKey, thresholds: OscillatorThresholds = DEFAULT_OSCILLATOR_THRESHOLDS): string {
  if (dim === "sourceType") return (t.source_type || "SIN_TIPO").trim() || "SIN_TIPO";
  if (dim === "sourceName") return (t.source_name || "SIN_FUENTE").trim() || "SIN_FUENTE";
  if (dim === "symbol") return (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
  if (dim === "timeframe") return (t.timeframe || "SIN_TF").trim() || "SIN_TF";
  if (dim === "session") return (t.session || "SIN_SESION").trim() || "SIN_SESION";
  if (dim === "patron") return (t.pattern_name || "SIN_PATRON").trim() || "SIN_PATRON";
  if (dim === "vela") return (t.candle_name || "SIN_VELA").trim() || "SIN_VELA";
  if (dim === "tendencia") return (t.tendencia || "SIN_TENDENCIA").trim() || "SIN_TENDENCIA";
  if (dim === "ea") return (t.ea || "SIN_EA").trim() || "SIN_EA";
  if (dim === "side") return (t.side || "SIN_DIRECCION").trim().toUpperCase() || "SIN_DIRECCION";
  if (dim === "rsiZone") return getRsiZone(t.rsi_value, thresholds);
  if (dim === "stochKZone") return getStochasticZone(t.stochastic_k, thresholds);
  if (dim === "stochDZone") return getStochasticZone(t.stochastic_d, thresholds);
  if (dim === "oscillatorConfluence") return getOscillatorConfluence(t, thresholds);
  if (dim === "rvolZone") return getRvolZone(t.rvol);
  if (dim === "adxZone") return getAdxZone(t.adx);
  if (dim === "emaContext") return getEmaContext(t);
  const d = dateOf(t);
  if (dim === "hour") return d ? `${String(getHourMazatlan(d)).padStart(2, "0")}:00` : "SIN_HORA";
  if (dim === "day") return d ? getDayMazatlan(d) : "SIN_FECHA";
  return "—";
}

function aggregateTrades(trades: FakeTradeRow[], dimensions: DimensionKey[], thresholds: OscillatorThresholds = DEFAULT_OSCILLATOR_THRESHOLDS): PerfRow[] {
  const map = new Map<
    string,
    { parts: string[]; trades: number; wins: number; losses: number; pending: number; neutral: number; days: number[] }
  >();

  trades.forEach((t) => {
    const parts = dimensions.map((d) => getTradeDimensionValue(t, d, thresholds));
    const key = parts.join(" + ");
    if (!map.has(key)) map.set(key, { parts, trades: 0, wins: 0, losses: 0, pending: 0, neutral: 0, days: [] });
    const rec = map.get(key)!;
    const kind = resultKind(t.result);
    rec.trades += 1;
    if (kind === "WIN") rec.wins += 1;
    else if (kind === "LOSS") rec.losses += 1;
    else if (kind === "PENDING") rec.pending += 1;
    else rec.neutral += 1;
    const dtt = daysToTarget(t);
    if (dtt !== null) rec.days.push(dtt);
  });

  const rows: PerfRow[] = [];
  map.forEach((v, key) => {
    const closed = v.wins + v.losses;
    const winRate = closed > 0 ? (v.wins / closed) * 100 : 0;
    const expectancy = closed > 0 ? ((v.wins - v.losses) / closed) * 100 : 0;
    const avgDaysToTarget = v.days.length ? v.days.reduce((a, b) => a + b, 0) / v.days.length : null;
    const sampleFactor = Math.min(v.trades / 10, 1);
    const score = winRate * 0.55 + Math.max(Math.min(expectancy * 0.4, 30), -30) + sampleFactor * 15;
    rows.push({
      key,
      parts: v.parts,
      trades: v.trades,
      wins: v.wins,
      losses: v.losses,
      pending: v.pending,
      neutral: v.neutral,
      winRate,
      expectancy,
      avgDaysToTarget,
      score,
    });
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.trades - a.trades;
  });
  return rows;
}

function getQualityBadge(row: PerfRow, minTrades: number) {
  const closed = row.wins + row.losses;
  if (row.trades < minTrades) return { label: "Muestra baja", bg: "#424242" };
  if (closed === 0) return { label: "Sin cierres", bg: "#374151" };
  if (row.winRate >= 60 && closed >= minTrades) return { label: "Fuerte", bg: "#166534" };
  if (row.winRate >= 50) return { label: "Prometedor", bg: "#365314" };
  if (row.winRate < 50) return { label: "Evitar", bg: "#991b1b" };
  return { label: "Neutral", bg: "#374151" };
}

function csvEscape(value: any) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===================== Dropdown de filtro estilo TopNav ===================== */

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "(Todos)",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="field">
      <div className="label">{label}</div>
      <div style={{ position: "relative" }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            fontSize: 13,
            height: 32,
            borderRadius: 0,
            border: value ? "1px solid #1d4ed8" : "1px solid #333",
            backgroundColor: value ? "#1d4ed8" : "#000",
            color: value ? "#ffffff" : "#ccc",
            fontWeight: value ? 600 : 400,
            cursor: "pointer",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || placeholder}</span>
          <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 6 }}>▾</span>
        </button>
        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              minWidth: 170,
              maxHeight: 260,
              overflowY: "auto",
              background: "#020617",
              border: "1px solid #1f2937",
              boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
              padding: 6,
              zIndex: 100,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                fontSize: 13,
                border: "1px solid transparent",
                backgroundColor: !value ? "#1d4ed8" : "transparent",
                color: !value ? "#ffffff" : "#cbd5e1",
                fontWeight: !value ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {placeholder}
            </button>
            {options.map((opt) => {
              const active = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: 13,
                    border: "1px solid transparent",
                    backgroundColor: active ? "#1d4ed8" : "transparent",
                    color: active ? "#ffffff" : "#cbd5e1",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "#111827";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Tabla genérica: sort + highlight + CSV ===================== */

function PerfTable({
  title,
  rows,
  columns,
  minTrades,
  idPrefix,
}: {
  title: string;
  rows: PerfRow[];
  columns: string[];
  minTrades: number;
  idPrefix: string;
}) {
  const [sortState, setSortState] = useState<SortState>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const displayRows = useMemo(() => {
    if (!sortState) return rows;
    const copy = rows.slice();
    const dir = sortState.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortState.colType === "part") {
        const av = a.parts[sortState.colIndex] ?? "";
        const bv = b.parts[sortState.colIndex] ?? "";
        return dir * String(av).localeCompare(String(bv));
      }
      const av = a[sortState.metric];
      const bv = b[sortState.metric];
      return dir * (av - bv);
    });
    return copy;
  }, [rows, sortState]);

  const handleSortPart = (idx: number) => {
    setSortState((prev) => {
      if (prev && prev.colType === "part" && prev.colIndex === idx) {
        return { colType: "part", colIndex: idx, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { colType: "part", colIndex: idx, dir: "asc" };
    });
  };

  const handleSortMetric = (metric: MetricSortKey) => {
    setSortState((prev) => {
      if (prev && prev.colType === "metric" && prev.metric === metric) {
        return { colType: "metric", metric, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { colType: "metric", metric, dir: "desc" };
    });
  };

  const arrowFor = (metric: MetricSortKey) =>
    sortState && sortState.colType === "metric" && sortState.metric === metric ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

  const handleExportTableCsv = () => {
    if (!displayRows.length) return;
    const headers = [...columns, "Trades", "Wins", "Losses", "Pendientes", "Win%", "Expectancy", "Calidad"];
    const dataRows = displayRows.map((r) => [
      ...r.parts,
      r.trades,
      r.wins,
      r.losses,
      r.pending,
      `${r.winRate.toFixed(1)}%`,
      r.expectancy.toFixed(1),
      getQualityBadge(r, minTrades).label,
    ]);
    downloadCsv(`bitlog_fake_${idPrefix}.csv`, headers, dataRows);
  };

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sortState && (
            <button type="button" title="Restaurar orden original" onClick={() => setSortState(null)} style={ICON_BTN_STYLE}>
              ↺
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 15 }}>{title}</h2>
        </div>
        <button type="button" title="Descargar CSV" onClick={handleExportTableCsv} style={ICON_BTN_STYLE}>
          ⬇
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              {columns.map((label, idx) => (
                <th key={`col-${idx}`} style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortPart(idx)}>
                  {label}
                  {sortState && sortState.colType === "part" && sortState.colIndex === idx ? (sortState.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("trades")}>
                Trades{arrowFor("trades")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("wins")}>
                Wins{arrowFor("wins")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("losses")}>
                Losses{arrowFor("losses")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("pending")}>
                Pend.{arrowFor("pending")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("winRate")}>
                Win%{arrowFor("winRate")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("expectancy")}>
                Expectancy{arrowFor("expectancy")}
              </th>
              <th style={TH_STYLE}>Calidad</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => {
              const isSelected = selectedKey === row.key;
              const isHovered = hoveredKey === row.key;
              const bg = isSelected ? "#1d4ed8" : isHovered ? "#1f2937" : idx % 2 === 0 ? "#151515" : "#101010";
              const rowStyle: React.CSSProperties = { ...TD_STYLE_BASE, backgroundColor: bg, cursor: "pointer" };
              const badge = getQualityBadge(row, minTrades);
              return (
                <tr
                  key={row.key}
                  onClick={() => setSelectedKey((prev) => (prev === row.key ? null : row.key))}
                  onMouseEnter={() => setHoveredKey(row.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  {row.parts.map((p, i) => (
                    <td key={i} style={rowStyle}>
                      {p}
                    </td>
                  ))}
                  <td style={rowStyle}>{row.trades}</td>
                  <td style={{ ...rowStyle, color: isSelected ? "#fff" : GREEN }}>{row.wins}</td>
                  <td style={{ ...rowStyle, color: isSelected ? "#fff" : RED }}>{row.losses}</td>
                  <td style={{ ...rowStyle, color: isSelected ? "#fff" : AMBER }}>{row.pending}</td>
                  <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                  <td style={{ ...rowStyle, color: isSelected ? "#fff" : row.expectancy > 0 ? GREEN : row.expectancy < 0 ? RED : "#ccc" }}>
                    {fmtScore(row.expectancy)}
                  </td>
                  <td style={rowStyle}>
                    <span style={{ ...BADGE_STYLE_BASE, backgroundColor: badge.bg, color: "#fff" }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
            {displayRows.length === 0 && (
              <tr>
                <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={columns.length + 7}>
                  Sin datos en este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Tabla de detalle de fake trades: sort + highlight ===================== */

function TradeDetailTable({ trades }: { trades: FakeTradeRow[] }) {
  const [sortKey, setSortKey] = useState<DetailSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const getSortValue = (t: FakeTradeRow, key: DetailSortKey): string | number => {
    switch (key) {
      case "id":
        return t.id;
      case "symbol":
        return t.symbol || "";
      case "timeframe":
        return t.timeframe || "";
      case "side":
        return t.side || "";
      case "ea":
        return t.ea || "";
      case "session":
        return t.session || "";
      case "sourceName":
        return t.source_name || "";
      case "patron":
        return t.pattern_name || "";
      case "vela":
        return t.candle_name || "";
      case "tendencia":
        return t.tendencia || "";
      case "setup":
        return dateOf(t) || "";
      case "target":
        return t.target_date || "";
      case "rsi":
        return safeNumber(t.rsi_value);
      case "stochK":
        return safeNumber(t.stochastic_k);
      case "stochD":
        return safeNumber(t.stochastic_d);
      case "result":
        return resultKind(t.result);
      default:
        return "";
    }
  };

  const displayTrades = useMemo(() => {
    if (!sortKey) return trades;
    const copy = trades.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (typeof av === "string" || typeof bv === "string") return dir * String(av).localeCompare(String(bv));
      return dir * ((av as number) - (bv as number));
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  const handleSort = (key: DetailSortKey) => {
    if (sortKey === key) {
      setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const arrow = (key: DetailSortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const columns: { key: DetailSortKey; label: string }[] = [
    { key: "id", label: "ID" },
    { key: "symbol", label: "Símbolo" },
    { key: "timeframe", label: "TF" },
    { key: "side", label: "Dirección" },
    { key: "ea", label: "EA" },
    { key: "sourceName", label: "Fuente" },
    { key: "session", label: "Sesión" },
    { key: "patron", label: "Patrón" },
    { key: "vela", label: "Vela" },
    { key: "tendencia", label: "Tendencia" },
    { key: "setup", label: "Setup" },
    { key: "target", label: "Target" },
    { key: "rsi", label: "RSI" },
    { key: "stochK", label: "Stoch K%" },
    { key: "stochD", label: "Stoch D%" },
    { key: "result", label: "Resultado" },
  ];

  const resultColor = (kind: string) => (kind === "WIN" ? GREEN : kind === "LOSS" ? RED : kind === "PENDING" ? AMBER : "#ccc");

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {sortKey && (
          <button type="button" title="Restaurar orden original" onClick={() => setSortKey(null)} style={ICON_BTN_STYLE}>
            ↺
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: 15 }}>Detalle de fake trades filtrados</h2>
      </div>
      <div style={{ maxHeight: 360, overflow: "auto", borderRadius: 8, border: "1px solid #222" }}>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
                </th>
              ))}
              <th style={TH_STYLE}>Ver</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map((t, idx) => {
              const kind = resultKind(t.result);
              const isSelected = selectedId === t.id;
              const isHovered = hoveredId === t.id;
              const bg = isSelected ? "#1d4ed8" : isHovered ? "#1f2937" : idx % 2 === 0 ? "#151515" : "#101010";
              const tdBase: React.CSSProperties = { ...TD_STYLE_BASE, backgroundColor: bg, cursor: "pointer" };
              return (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId((prev) => (prev === t.id ? null : t.id))}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <td style={tdBase}>{t.id}</td>
                  <td style={tdBase}>{t.symbol || "—"}</td>
                  <td style={tdBase}>{t.timeframe || "—"}</td>
                  <td style={tdBase}>{(t.side || "—").toUpperCase()}</td>
                  <td style={tdBase}>{t.ea || "—"}</td>
                  <td style={tdBase}>{t.source_name || "—"}</td>
                  <td style={tdBase}>{t.session || "—"}</td>
                  <td style={tdBase}>{t.pattern_name || "—"}</td>
                  <td style={tdBase}>{t.candle_name || "—"}</td>
                  <td style={tdBase}>{t.tendencia || "—"}</td>
                  <td style={tdBase}>{fmtDateShort(dateOf(t))}</td>
                  <td style={tdBase}>{fmtDateShort(t.target_date)}</td>
                  <td style={tdBase}>{t.rsi_value ?? "—"}</td>
                  <td style={tdBase}>{t.stochastic_k ?? "—"}</td>
                  <td style={tdBase}>{t.stochastic_d ?? "—"}</td>
                  <td style={{ ...tdBase, color: isSelected ? "#fff" : resultColor(kind) }}>{t.result || "PENDING"}</td>
                  <td style={tdBase} onClick={(e) => e.stopPropagation()}>
                    <a href={`/fake-trades/${t.id}`} className="btn link" style={{ fontSize: 11, padding: "3px 6px" }}>
                      Ver
                    </a>
                  </td>
                </tr>
              );
            })}
            {displayTrades.length === 0 && (
              <tr>
                <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={17}>
                  Sin fake trades en este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Tooltip de mini-gráficas con conteo de trades ===================== */

function MiniChartTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null;
  const row: PerfRow = payload[0].payload;
  return (
    <div style={{ backgroundColor: "#111", border: "1px solid #333", padding: "8px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.key}</div>
      <div style={{ opacity: 0.85 }}>
        {row.trades} tr. | {row.wins} W | {row.losses} L | {row.pending} pend.
      </div>
      <div style={{ marginTop: 2, color: row.expectancy > 0 ? GREEN : row.expectancy < 0 ? RED : "#ccc" }}>
        Win% {fmtPct(row.winRate)} · Expectancy {fmtScore(row.expectancy)}
      </div>
    </div>
  );
}

/* ===================== Página principal ===================== */

export default function FakeTradeChartsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<FakeTradeRow[]>([]);

  const [filterDateFromDraft, setFilterDateFromDraft] = useState("");
  const [filterDateToDraft, setFilterDateToDraft] = useState("");
  const [filterSourceTypeDraft, setFilterSourceTypeDraft] = useState("");
  const [filterSourceNameDraft, setFilterSourceNameDraft] = useState("");
  const [filterSymbolDraft, setFilterSymbolDraft] = useState("");
  const [filterTfDraft, setFilterTfDraft] = useState("");
  const [filterSideDraft, setFilterSideDraft] = useState("");
  const [filterSessionDraft, setFilterSessionDraft] = useState("");
  const [filterPatronDraft, setFilterPatronDraft] = useState("");
  const [filterVelaDraft, setFilterVelaDraft] = useState("");
  const [filterTendenciaDraft, setFilterTendenciaDraft] = useState("");
  const [filterEaDraft, setFilterEaDraft] = useState("");
  const [filterResultDraft, setFilterResultDraft] = useState("");
  const [filterDayDraft, setFilterDayDraft] = useState("");
  const [filterHourDraft, setFilterHourDraft] = useState("");

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSourceType, setFilterSourceType] = useState("");
  const [filterSourceName, setFilterSourceName] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterPatron, setFilterPatron] = useState("");
  const [filterVela, setFilterVela] = useState("");
  const [filterTendencia, setFilterTendencia] = useState("");
  const [filterEa, setFilterEa] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterHour, setFilterHour] = useState("");

  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetName, setSelectedPresetName] = useState("");

  const [minTrades, setMinTrades] = useState(3);
  const [dynamicMetric, setDynamicMetric] = useState<MetricKey>("winRate");
  const [dynamicDims, setDynamicDims] = useState<DimensionKey[]>(["sourceName", "symbol", "timeframe"]);

  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [stochOversold, setStochOversold] = useState(20);
  const [stochOverbought, setStochOverbought] = useState(80);

  const oscillatorThresholds = useMemo(
    () => ({
      rsiOversold: normalizeThreshold(rsiOversold, 30),
      rsiOverbought: normalizeThreshold(rsiOverbought, 70),
      stochOversold: normalizeThreshold(stochOversold, 20),
      stochOverbought: normalizeThreshold(stochOverbought, 80),
    }),
    [rsiOversold, rsiOverbought, stochOversold, stochOverbought]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setError("No hay sesión. Inicia en /login.");
          setTrades([]);
          return;
        }
        const { data, error: qErr } = await supabase
          .from("fake_trades")
          .select("*")
          .eq("user_id", uid)
          .order("setup_datetime", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .limit(5000);
        if (qErr) throw qErr;
        if (!cancelled) setTrades((data || []) as unknown as FakeTradeRow[]);
      } catch (err: any) {
        if (!cancelled) {
          setError(String(err?.message ?? err));
          setTrades([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("bitlog_faketrade_chart_presets");
      if (raw) {
        const parsed = JSON.parse(raw) as FilterPreset[];
        if (Array.isArray(parsed)) setPresets(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("bitlog_faketrade_chart_presets", JSON.stringify(presets));
    } catch {}
  }, [presets]);

  const uniqueValues = (getter: (t: FakeTradeRow) => string | null | undefined) => {
    const s = new Set<string>();
    trades.forEach((t) => {
      const v = getter(t);
      if (v && v.trim()) s.add(v.trim());
    });
    return Array.from(s).sort();
  };

  const allSourceTypes = useMemo(() => uniqueValues((t) => t.source_type), [trades]);
  const allSourceNames = useMemo(() => uniqueValues((t) => t.source_name), [trades]);
  const allSymbols = useMemo(() => uniqueValues((t) => t.symbol), [trades]);
  const allTimeframes = useMemo(() => uniqueValues((t) => t.timeframe), [trades]);
  const allSessions = useMemo(() => uniqueValues((t) => t.session), [trades]);
  const allPatrones = useMemo(() => uniqueValues((t) => t.pattern_name), [trades]);
  const allVelas = useMemo(() => uniqueValues((t) => t.candle_name), [trades]);
  const allTendencias = useMemo(() => uniqueValues((t) => t.tendencia), [trades]);
  const allEAs = useMemo(() => uniqueValues((t) => t.ea), [trades]);
  const allResults = useMemo(() => uniqueValues((t) => t.result), [trades]);

  const allDays = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      const d = dateOf(t);
      if (d) s.add(getDayMazatlan(d));
    });
    return Array.from(s).sort((a, b) => {
      const ia = WEEKDAY_ORDER.indexOf(a.toLowerCase());
      const ib = WEEKDAY_ORDER.indexOf(b.toLowerCase());
      if (ia === -1 || ib === -1) return a.localeCompare(b);
      return ia - ib;
    });
  }, [trades]);

  const allHours = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      const d = dateOf(t);
      if (d) s.add(`${String(getHourMazatlan(d)).padStart(2, "0")}:00`);
    });
    return Array.from(s).sort();
  }, [trades]);

  const visibleTrades = useMemo(() => {
    let list = trades.slice();
    if (filterDateFrom) {
      const dFrom = new Date(filterDateFrom + "T00:00:00");
      list = list.filter((t) => {
        const d = dateOf(t);
        return !!d && new Date(d) >= dFrom;
      });
    }
    if (filterDateTo) {
      const dTo = new Date(filterDateTo + "T23:59:59");
      list = list.filter((t) => {
        const d = dateOf(t);
        return !!d && new Date(d) <= dTo;
      });
    }
    if (filterSourceType) list = list.filter((t) => (t.source_type || "").toUpperCase() === filterSourceType.toUpperCase());
    if (filterSourceName) list = list.filter((t) => (t.source_name || "").toUpperCase() === filterSourceName.toUpperCase());
    if (filterSymbol) list = list.filter((t) => (t.symbol || "").toUpperCase() === filterSymbol.toUpperCase());
    if (filterTf) list = list.filter((t) => (t.timeframe || "").toUpperCase() === filterTf.toUpperCase());
    if (filterSide) list = list.filter((t) => (t.side || "").toUpperCase() === filterSide.toUpperCase());
    if (filterSession) list = list.filter((t) => (t.session || "").toUpperCase() === filterSession.toUpperCase());
    if (filterPatron) list = list.filter((t) => (t.pattern_name || "").toUpperCase() === filterPatron.toUpperCase());
    if (filterVela) list = list.filter((t) => (t.candle_name || "").toUpperCase() === filterVela.toUpperCase());
    if (filterTendencia) list = list.filter((t) => (t.tendencia || "").toUpperCase() === filterTendencia.toUpperCase());
    if (filterEa) list = list.filter((t) => (t.ea || "").toUpperCase() === filterEa.toUpperCase());
    if (filterResult) list = list.filter((t) => resultKind(t.result) === filterResult);
    if (filterDay) list = list.filter((t) => (dateOf(t) ? getDayMazatlan(dateOf(t)!) : "SIN_FECHA") === filterDay);
    if (filterHour)
      list = list.filter((t) => (dateOf(t) ? `${String(getHourMazatlan(dateOf(t)!)).padStart(2, "0")}:00` : "SIN_HORA") === filterHour);
    return list;
  }, [
    trades,
    filterDateFrom,
    filterDateTo,
    filterSourceType,
    filterSourceName,
    filterSymbol,
    filterTf,
    filterSide,
    filterSession,
    filterPatron,
    filterVela,
    filterTendencia,
    filterEa,
    filterResult,
    filterDay,
    filterHour,
  ]);

  const summary = useMemo(() => {
    const total = visibleTrades.length;
    let wins = 0;
    let losses = 0;
    let pending = 0;
    let neutral = 0;
    visibleTrades.forEach((t) => {
      const k = resultKind(t.result);
      if (k === "WIN") wins++;
      else if (k === "LOSS") losses++;
      else if (k === "PENDING") pending++;
      else neutral++;
    });
    const closed = wins + losses;
    return {
      total,
      wins,
      losses,
      pending,
      neutral,
      closed,
      winRate: closed ? (wins / closed) * 100 : 0,
      expectancy: closed ? ((wins - losses) / closed) * 100 : 0,
    };
  }, [visibleTrades]);

  const avgDaysToTarget = useMemo(() => {
    let total = 0;
    let count = 0;
    visibleTrades.forEach((t) => {
      const d = daysToTarget(t);
      if (d !== null) {
        total += d;
        count++;
      }
    });
    return count ? total / count : null;
  }, [visibleTrades]);

  const perfBySourceType = useMemo(() => aggregateTrades(visibleTrades, ["sourceType"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfBySourceName = useMemo(() => aggregateTrades(visibleTrades, ["sourceName"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfBySymbol = useMemo(() => aggregateTrades(visibleTrades, ["symbol"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByTimeframe = useMemo(() => aggregateTrades(visibleTrades, ["timeframe"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfBySession = useMemo(() => aggregateTrades(visibleTrades, ["session"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByDay = useMemo(() => aggregateTrades(visibleTrades, ["day"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByHour = useMemo(() => aggregateTrades(visibleTrades, ["hour"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByPatron = useMemo(() => aggregateTrades(visibleTrades, ["patron"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByVela = useMemo(() => aggregateTrades(visibleTrades, ["vela"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByTendencia = useMemo(() => aggregateTrades(visibleTrades, ["tendencia"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByEa = useMemo(() => aggregateTrades(visibleTrades, ["ea"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfBySide = useMemo(() => aggregateTrades(visibleTrades, ["side"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByRsiZone = useMemo(() => aggregateTrades(visibleTrades, ["rsiZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByStochKZone = useMemo(() => aggregateTrades(visibleTrades, ["stochKZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByStochDZone = useMemo(() => aggregateTrades(visibleTrades, ["stochDZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByOscillatorConfluence = useMemo(() => aggregateTrades(visibleTrades, ["oscillatorConfluence"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByRvolZone = useMemo(() => aggregateTrades(visibleTrades, ["rvolZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByAdxZone = useMemo(() => aggregateTrades(visibleTrades, ["adxZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const perfByEmaContext = useMemo(() => aggregateTrades(visibleTrades, ["emaContext"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);

  const confluenceBase = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluencePatron = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "patron"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceVela = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "vela"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceTendencia = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "tendencia"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceSession = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "session"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceSide = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "side"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceRsi = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "rsiZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceStochK = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "stochKZone"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);
  const confluenceOscillators = useMemo(() => aggregateTrades(visibleTrades, ["sourceName", "symbol", "timeframe", "oscillatorConfluence"], oscillatorThresholds), [visibleTrades, oscillatorThresholds]);

  const dynamicConfluence = useMemo(() => aggregateTrades(visibleTrades, dynamicDims, oscillatorThresholds), [visibleTrades, oscillatorThresholds, dynamicDims]);
  const dynamicColumnLabels = useMemo(() => dynamicDims.map((d) => DIMENSION_LABELS[d]), [dynamicDims]);

  const topBest = useMemo(() => dynamicConfluence.filter((r) => r.trades >= minTrades && r.wins + r.losses > 0 && r.expectancy > 0).slice(0, 5), [dynamicConfluence, minTrades]);
  const topWorst = useMemo(
    () =>
      dynamicConfluence
        .filter((r) => r.trades >= minTrades && r.wins + r.losses > 0 && r.expectancy < 0)
        .slice()
        .sort((a, b) => a.expectancy - b.expectancy)
        .slice(0, 5),
    [dynamicConfluence, minTrades]
  );

  const accuracyCurve = useMemo(() => {
    let wins = 0;
    let closed = 0;
    return visibleTrades
      .slice()
      .filter((t) => !!dateOf(t) && resultKind(t.result) !== "PENDING")
      .sort((a, b) => new Date(dateOf(a) || "").getTime() - new Date(dateOf(b) || "").getTime())
      .map((t, idx) => {
        closed += 1;
        if (resultKind(t.result) === "WIN") wins += 1;
        return { n: idx + 1, winRate: (wins / closed) * 100, label: fmtDateShort(dateOf(t)) };
      });
  }, [visibleTrades]);

  const pieResultData = useMemo(
    () => [
      { name: "Ganadas", value: summary.wins },
      { name: "Perdidas", value: summary.losses },
      { name: "Pendientes", value: summary.pending },
      { name: "Neutras", value: summary.neutral },
    ],
    [summary]
  );

  const applyQuickPreset = (type: "today" | "7d" | "30d" | "pendientes") => {
    if (type === "today") {
      const today = getTodayMazatlan();
      setFilterDateFromDraft(today);
      setFilterDateToDraft(today);
      setFilterDateFrom(today);
      setFilterDateTo(today);
    } else if (type === "7d") {
      const today = getTodayMazatlan();
      const from = addDaysToDateString(today, -6);
      setFilterDateFromDraft(from);
      setFilterDateToDraft(today);
      setFilterDateFrom(from);
      setFilterDateTo(today);
    } else if (type === "30d") {
      const today = getTodayMazatlan();
      const from = addDaysToDateString(today, -29);
      setFilterDateFromDraft(from);
      setFilterDateToDraft(today);
      setFilterDateFrom(from);
      setFilterDateTo(today);
    } else {
      setFilterResultDraft("PENDING");
      setFilterResult("PENDING");
    }
  };

  const handleApplyGlobalFilters = () => {
    setFilterDateFrom(filterDateFromDraft);
    setFilterDateTo(filterDateToDraft);
    setFilterSourceType(filterSourceTypeDraft);
    setFilterSourceName(filterSourceNameDraft);
    setFilterSymbol(filterSymbolDraft);
    setFilterTf(filterTfDraft);
    setFilterSide(filterSideDraft);
    setFilterSession(filterSessionDraft);
    setFilterPatron(filterPatronDraft);
    setFilterVela(filterVelaDraft);
    setFilterTendencia(filterTendenciaDraft);
    setFilterEa(filterEaDraft);
    setFilterResult(filterResultDraft);
    setFilterDay(filterDayDraft);
    setFilterHour(filterHourDraft);
  };

  const handleClearGlobalFilters = () => {
    setFilterDateFromDraft("");
    setFilterDateToDraft("");
    setFilterSourceTypeDraft("");
    setFilterSourceNameDraft("");
    setFilterSymbolDraft("");
    setFilterTfDraft("");
    setFilterSideDraft("");
    setFilterSessionDraft("");
    setFilterPatronDraft("");
    setFilterVelaDraft("");
    setFilterTendenciaDraft("");
    setFilterEaDraft("");
    setFilterResultDraft("");
    setFilterDayDraft("");
    setFilterHourDraft("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSourceType("");
    setFilterSourceName("");
    setFilterSymbol("");
    setFilterTf("");
    setFilterSide("");
    setFilterSession("");
    setFilterPatron("");
    setFilterVela("");
    setFilterTendencia("");
    setFilterEa("");
    setFilterResult("");
    setFilterDay("");
    setFilterHour("");
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const newPreset: FilterPreset = {
      name,
      dateFrom: filterDateFromDraft,
      dateTo: filterDateToDraft,
      sourceType: filterSourceTypeDraft,
      sourceName: filterSourceNameDraft,
      symbol: filterSymbolDraft,
      tf: filterTfDraft,
      side: filterSideDraft,
      session: filterSessionDraft,
      patron: filterPatronDraft,
      vela: filterVelaDraft,
      tendencia: filterTendenciaDraft,
      ea: filterEaDraft,
      result: filterResultDraft,
      day: filterDayDraft,
      hour: filterHourDraft,
    };
    setPresets((prev) => [...prev.filter((p) => p.name !== name), newPreset]);
    setSelectedPresetName(name);
  };

  const handleLoadPreset = () => {
    const p = presets.find((x) => x.name === selectedPresetName);
    if (!p) return;
    setFilterDateFromDraft(p.dateFrom);
    setFilterDateToDraft(p.dateTo);
    setFilterSourceTypeDraft(p.sourceType || "");
    setFilterSourceNameDraft(p.sourceName || "");
    setFilterSymbolDraft(p.symbol);
    setFilterTfDraft(p.tf);
    setFilterSideDraft(p.side);
    setFilterSessionDraft(p.session);
    setFilterPatronDraft(p.patron || "");
    setFilterVelaDraft(p.vela || "");
    setFilterTendenciaDraft(p.tendencia || "");
    setFilterEaDraft(p.ea || "");
    setFilterResultDraft(p.result || "");
    setFilterDayDraft(p.day || "");
    setFilterHourDraft(p.hour || "");
    setFilterDateFrom(p.dateFrom);
    setFilterDateTo(p.dateTo);
    setFilterSourceType(p.sourceType || "");
    setFilterSourceName(p.sourceName || "");
    setFilterSymbol(p.symbol);
    setFilterTf(p.tf);
    setFilterSide(p.side);
    setFilterSession(p.session);
    setFilterPatron(p.patron || "");
    setFilterVela(p.vela || "");
    setFilterTendencia(p.tendencia || "");
    setFilterEa(p.ea || "");
    setFilterResult(p.result || "");
    setFilterDay(p.day || "");
    setFilterHour(p.hour || "");
  };

  const handleExportCsv = () => {
    if (!visibleTrades.length) return;
    const headers = [
      "id", "symbol", "side", "timeframe", "setup_datetime", "target_date", "source_type", "source_name", "source_url",
      "pattern_name", "candle_name", "ea", "entry_price", "stop_loss", "take_profit", "tp1", "tp2", "resistance", "pivot",
      "support", "tendencia", "session", "rsi_value", "stochastic_k", "stochastic_d", "ema20", "ema50", "ema100", "ema200",
      "atr", "adx", "rvol", "expected_move", "failure_reason", "lessons_learned", "result", "notes",
    ];
    const rows = visibleTrades.map((t) =>
      [
        t.id, t.symbol, t.side, t.timeframe, t.setup_datetime, t.target_date, t.source_type, t.source_name, t.source_url,
        t.pattern_name, t.candle_name, t.ea, t.entry_price, t.stop_loss, t.take_profit, t.tp1, t.tp2, t.resistance, t.pivot,
        t.support, t.tendencia, t.session, t.rsi_value, t.stochastic_k, t.stochastic_d, t.ema20, t.ema50, t.ema100, t.ema200,
        t.atr, t.adx, t.rvol, t.expected_move, t.failure_reason, t.lessons_learned, t.result, t.notes,
      ].map(csvEscape).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bitlog_fake_trades_filtrado.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDynamicDim = (dim: DimensionKey) => {
    setDynamicDims((prev) => {
      if (prev.includes(dim)) return prev.length === 1 ? prev : prev.filter((d) => d !== dim);
      return [...prev, dim];
    });
  };

  const chartMetricLabel = dynamicMetric === "winRate" ? "Win%" : dynamicMetric === "expectancy" ? "Expectancy" : "Trades";
  const chartRows = dynamicConfluence.filter((r) => r.trades >= minTrades).slice(0, 12).map((r) => ({ ...r, metric: r[dynamicMetric] }));
  const dynamicChartHeight = Math.max(320, chartRows.length * 42);

  const renderButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", fontSize: 12, borderRadius: 0, minWidth: 0, width: "auto" };

  const renderMiniChart = (title: string, rows: PerfRow[], metric: MetricKey = "winRate") => {
    const data = rows.filter((r) => r.trades >= minTrades).slice(0, 8).map((r) => ({ ...r, metric: r[metric] }));
    return (
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>{title}</h2>
        {data.length === 0 ? (
          <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos suficientes.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="key" stroke={AXIS} tick={{ fontSize: 11 }} interval={0} />
                <YAxis stroke={AXIS} />
                <Tooltip content={<MiniChartTooltipContent />} />
                <Bar dataKey="metric" name={metric === "winRate" ? "Win%" : metric === "expectancy" ? "Expectancy" : "Trades"} radius={[6, 6, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={Number(entry.metric) >= 0 ? GREEN : RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <TopNav />

      <div style={CARD_STYLE}>
        <h1 className="title" style={{ marginTop: 0, marginBottom: 8 }}>
          Charts Fake Trades — Dashboard &amp; Confluencias
        </h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 13, marginBottom: 8 }}>
          Laboratorio estadístico de predicciones externas (fake trades). No toca tus trades reales.
        </p>
        <div style={{ fontSize: 13, marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={handleApplyGlobalFilters} style={renderButtonStyle}>Aplicar filtros</button>
          <button type="button" className="btn" onClick={handleClearGlobalFilters} style={renderButtonStyle}>Limpiar filtros</button>
          <button type="button" className="btn" onClick={handleExportCsv} style={renderButtonStyle}>Exportar CSV filtrados</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("today")} style={renderButtonStyle}>Hoy</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("7d")} style={renderButtonStyle}>Últimos 7 días</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("30d")} style={renderButtonStyle}>Últimos 30 días</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("pendientes")} style={renderButtonStyle}>Solo pendientes</button>
          <a className="btn secondary" href="/fake-trades" style={renderButtonStyle}>Volver a Fake Trades</a>
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={{ ...BADGE_STYLE_BASE, backgroundColor: summary.winRate >= 60 ? "#166534" : summary.winRate >= 50 ? "#374151" : "#991b1b", color: "#fff" }}>
            Win rate global: {fmtPct(summary.winRate)}
          </span>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Filtros globales</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <div className="field">
            <div className="label">Desde</div>
            <input className="input" type="date" value={filterDateFromDraft} onChange={(e) => setFilterDateFromDraft(e.target.value)} />
          </div>
          <div className="field">
            <div className="label">Hasta</div>
            <input className="input" type="date" value={filterDateToDraft} onChange={(e) => setFilterDateToDraft(e.target.value)} />
          </div>
          <FilterDropdown label="Tipo de fuente" value={filterSourceTypeDraft} options={allSourceTypes} onChange={setFilterSourceTypeDraft} />
          <FilterDropdown label="Fuente" value={filterSourceNameDraft} options={allSourceNames} onChange={setFilterSourceNameDraft} />
          <FilterDropdown label="Símbolo" value={filterSymbolDraft} options={allSymbols} onChange={setFilterSymbolDraft} />
          <FilterDropdown label="Timeframe" value={filterTfDraft} options={allTimeframes} onChange={setFilterTfDraft} />
          <FilterDropdown label="Dirección" value={filterSideDraft} options={["BUY", "SELL"]} onChange={setFilterSideDraft} placeholder="(Todas)" />
          <FilterDropdown label="Sesión" value={filterSessionDraft} options={allSessions} onChange={setFilterSessionDraft} placeholder="(Todas)" />
          <FilterDropdown label="Patrón" value={filterPatronDraft} options={allPatrones} onChange={setFilterPatronDraft} placeholder="(Todos)" />
          <FilterDropdown label="Vela" value={filterVelaDraft} options={allVelas} onChange={setFilterVelaDraft} placeholder="(Todas)" />
          <FilterDropdown label="Tendencia" value={filterTendenciaDraft} options={allTendencias} onChange={setFilterTendenciaDraft} placeholder="(Todas)" />
          <FilterDropdown label="EA" value={filterEaDraft} options={allEAs} onChange={setFilterEaDraft} placeholder="(Todos)" />
          <FilterDropdown label="Resultado" value={filterResultDraft} options={allResults} onChange={setFilterResultDraft} placeholder="(Todos)" />
          <FilterDropdown label="Día" value={filterDayDraft} options={allDays} onChange={setFilterDayDraft} placeholder="(Todos)" />
          <FilterDropdown label="Hora" value={filterHourDraft} options={allHours} onChange={setFilterHourDraft} placeholder="(Todas)" />

          <div className="field">
            <div className="label">Mínimo de trades</div>
            <select className="input" value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="field">
            <div className="label">RSI sobreventa</div>
            <input className="input" type="number" min={0} max={100} step={1} value={rsiOversold} onChange={(e) => setRsiOversold(Number(e.target.value))} />
          </div>

          <div className="field">
            <div className="label">RSI sobrecompra</div>
            <input className="input" type="number" min={0} max={100} step={1} value={rsiOverbought} onChange={(e) => setRsiOverbought(Number(e.target.value))} />
          </div>

          <div className="field">
            <div className="label">Stoch sobreventa</div>
            <input className="input" type="number" min={0} max={100} step={1} value={stochOversold} onChange={(e) => setStochOversold(Number(e.target.value))} />
          </div>

          <div className="field">
            <div className="label">Stoch sobrecompra</div>
            <input className="input" type="number" min={0} max={100} step={1} value={stochOverbought} onChange={(e) => setStochOverbought(Number(e.target.value))} />
          </div>

          <div className="field">
            <div className="label">Umbrales activos</div>
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
              RSI &lt; {oscillatorThresholds.rsiOversold} = Sobreventa · RSI &gt; {oscillatorThresholds.rsiOverbought} = Sobrecompra<br />
              Stoch &lt; {oscillatorThresholds.stochOversold} = Sobreventa · Stoch &gt; {oscillatorThresholds.stochOverbought} = Sobrecompra
            </div>
          </div>

          <div className="field">
            <div className="label">Nombre de preset</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input" type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Ej. Señales Telegram XAU" />
              <button type="button" className="btn" onClick={handleSavePreset} style={renderButtonStyle}>Guardar preset</button>
            </div>
          </div>

          <div className="field">
            <div className="label">Presets guardados</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="input" value={selectedPresetName} onChange={(e) => setSelectedPresetName(e.target.value)}>
                <option value="">(Ninguno)</option>
                {presets.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <button type="button" className="btn" onClick={handleLoadPreset} style={renderButtonStyle}>Cargar preset</button>
            </div>
          </div>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Resumen global</h2>
        {loading ? (
          <p>Cargando…</p>
        ) : error ? (
          <p style={{ color: "#f88" }}>{error}</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 12 }}>
              <div><div className="label">Predicciones</div><div style={{ fontSize: 18, fontWeight: 700 }}>{summary.total}</div></div>
              <div><div className="label">Ganadas</div><div style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{summary.wins}</div></div>
              <div><div className="label">Perdidas</div><div style={{ fontSize: 18, fontWeight: 700, color: RED }}>{summary.losses}</div></div>
              <div><div className="label">Pendientes</div><div style={{ fontSize: 18, fontWeight: 700, color: AMBER }}>{summary.pending}</div></div>
              <div><div className="label">Win rate</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(summary.winRate)}</div></div>
              <div><div className="label">Expectancy</div><div style={{ fontSize: 18, fontWeight: 700, color: summary.expectancy > 0 ? GREEN : summary.expectancy < 0 ? RED : "#ccc" }}>{fmtScore(summary.expectancy)}</div></div>
              <div><div className="label">Horizonte promedio a target</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtDays(avgDaysToTarget)}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
              <PerfTable title="Top mejor comportamiento" rows={topBest} columns={dynamicColumnLabels} minTrades={minTrades} idPrefix="top_mejor" />
              <PerfTable title="Top peor comportamiento" rows={topWorst} columns={dynamicColumnLabels} minTrades={minTrades} idPrefix="top_peor" />
            </div>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 2fr) minmax(260px, 1fr)", gap: 16, marginBottom: 16 }}>
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Precisión acumulada — Win rate</h2>
          {accuracyCurve.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos.</p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accuracyCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="n" stroke={AXIS} tick={{ fontSize: 11 }} />
                  <YAxis stroke={AXIS} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(value: any) => fmtPct(Number(value))} labelFormatter={(label) => `Predicción #${label}`} />
                  <Line type="monotone" dataKey="winRate" name="Win rate acumulado" stroke={summary.winRate >= 50 ? GREEN : RED} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Distribución de resultados</h2>
          {summary.total === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos.</p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
                  <Legend />
                  <Pie data={pieResultData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>
                    {[GREEN, RED, AMBER, NEUTRAL].map((c) => (
                      <Cell key={c} fill={c} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 18, margin: "4px 0 12px" }}>Dónde acierto / dónde fallo</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        {renderMiniChart("Win% por tipo de fuente", perfBySourceType)}
        {renderMiniChart("Win% por fuente", perfBySourceName)}
        {renderMiniChart("Win% por símbolo", perfBySymbol)}
        {renderMiniChart("Win% por timeframe", perfByTimeframe)}
        {renderMiniChart("Win% por sesión", perfBySession)}
        {renderMiniChart("Win% por día", perfByDay)}
        {renderMiniChart("Win% por hora", perfByHour)}
        {renderMiniChart("Win% por patrón", perfByPatron)}
        {renderMiniChart("Win% por vela", perfByVela)}
        {renderMiniChart("Win% por tendencia", perfByTendencia)}
        {renderMiniChart("Win% por EA", perfByEa)}
        {renderMiniChart("Win% por dirección BUY/SELL", perfBySide)}
        {renderMiniChart("Win% por zona RSI", perfByRsiZone)}
        {renderMiniChart("Win% por zona Estocástico K%", perfByStochKZone)}
        {renderMiniChart("Win% por confluencia RSI/Stoch", perfByOscillatorConfluence)}
        {renderMiniChart("Win% por zona RVOL", perfByRvolZone)}
        {renderMiniChart("Win% por zona ADX", perfByAdxZone)}
        {renderMiniChart("Win% por contexto de EMAs", perfByEmaContext)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        <PerfTable title="Performance por tipo de fuente" rows={perfBySourceType} columns={["Tipo de fuente"]} minTrades={minTrades} idPrefix="perf_source_type" />
        <PerfTable title="Performance por fuente" rows={perfBySourceName} columns={["Fuente"]} minTrades={minTrades} idPrefix="perf_source_name" />
        <PerfTable title="Performance por símbolo" rows={perfBySymbol} columns={["Símbolo"]} minTrades={minTrades} idPrefix="perf_symbol" />
        <PerfTable title="Performance por timeframe" rows={perfByTimeframe} columns={["TF"]} minTrades={minTrades} idPrefix="perf_tf" />
        <PerfTable title="Performance por sesión" rows={perfBySession} columns={["Sesión"]} minTrades={minTrades} idPrefix="perf_session" />
        <PerfTable title="Performance por día" rows={perfByDay} columns={["Día"]} minTrades={minTrades} idPrefix="perf_day" />
        <PerfTable title="Performance por hora" rows={perfByHour} columns={["Hora"]} minTrades={minTrades} idPrefix="perf_hour" />
        <PerfTable title="Performance por patrón" rows={perfByPatron} columns={["Patrón"]} minTrades={minTrades} idPrefix="perf_patron" />
        <PerfTable title="Performance por vela" rows={perfByVela} columns={["Vela"]} minTrades={minTrades} idPrefix="perf_vela" />
        <PerfTable title="Performance por tendencia" rows={perfByTendencia} columns={["Tendencia"]} minTrades={minTrades} idPrefix="perf_tendencia" />
        <PerfTable title="Performance por EA" rows={perfByEa} columns={["EA"]} minTrades={minTrades} idPrefix="perf_ea" />
        <PerfTable title="Performance por dirección" rows={perfBySide} columns={["Dirección"]} minTrades={minTrades} idPrefix="perf_side" />
        <PerfTable title="Performance por zona RSI" rows={perfByRsiZone} columns={["Zona RSI"]} minTrades={minTrades} idPrefix="perf_rsi_zone" />
        <PerfTable title="Performance por zona Estocástico K%" rows={perfByStochKZone} columns={["Zona Stoch K%"]} minTrades={minTrades} idPrefix="perf_stoch_k_zone" />
        <PerfTable title="Performance por zona Estocástico D%" rows={perfByStochDZone} columns={["Zona Stoch D%"]} minTrades={minTrades} idPrefix="perf_stoch_d_zone" />
        <PerfTable title="Performance por confluencia RSI/Stoch" rows={perfByOscillatorConfluence} columns={["Confluencia"]} minTrades={minTrades} idPrefix="perf_oscillator_confluence" />
        <PerfTable title="Performance por zona RVOL" rows={perfByRvolZone} columns={["Zona RVOL"]} minTrades={minTrades} idPrefix="perf_rvol_zone" />
        <PerfTable title="Performance por zona ADX" rows={perfByAdxZone} columns={["Zona ADX"]} minTrades={minTrades} idPrefix="perf_adx_zone" />
        <PerfTable title="Performance por contexto de EMAs" rows={perfByEmaContext} columns={["Contexto EMAs"]} minTrades={minTrades} idPrefix="perf_ema_context" />
      </div>

      <h2 style={{ fontSize: 18, margin: "4px 0 12px" }}>Confluencias fijas</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
        <PerfTable title="Fuente + símbolo + TF" rows={confluenceBase} columns={["Fuente", "Símbolo", "TF"]} minTrades={minTrades} idPrefix="confluencia_base" />
        <PerfTable title="Fuente + símbolo + TF + patrón" rows={confluencePatron} columns={["Fuente", "Símbolo", "TF", "Patrón"]} minTrades={minTrades} idPrefix="confluencia_patron" />
        <PerfTable title="Fuente + símbolo + TF + vela" rows={confluenceVela} columns={["Fuente", "Símbolo", "TF", "Vela"]} minTrades={minTrades} idPrefix="confluencia_vela" />
        <PerfTable title="Fuente + símbolo + TF + tendencia" rows={confluenceTendencia} columns={["Fuente", "Símbolo", "TF", "Tendencia"]} minTrades={minTrades} idPrefix="confluencia_tendencia" />
        <PerfTable title="Fuente + símbolo + TF + sesión" rows={confluenceSession} columns={["Fuente", "Símbolo", "TF", "Sesión"]} minTrades={minTrades} idPrefix="confluencia_sesion" />
        <PerfTable title="Fuente + símbolo + TF + dirección BUY/SELL" rows={confluenceSide} columns={["Fuente", "Símbolo", "TF", "Dirección"]} minTrades={minTrades} idPrefix="confluencia_side" />
        <PerfTable title="Fuente + símbolo + TF + zona RSI" rows={confluenceRsi} columns={["Fuente", "Símbolo", "TF", "Zona RSI"]} minTrades={minTrades} idPrefix="confluencia_rsi" />
        <PerfTable title="Fuente + símbolo + TF + zona Stoch K%" rows={confluenceStochK} columns={["Fuente", "Símbolo", "TF", "Zona Stoch K%"]} minTrades={minTrades} idPrefix="confluencia_stoch_k" />
        <PerfTable title="Fuente + símbolo + TF + confluencia RSI/Stoch" rows={confluenceOscillators} columns={["Fuente", "Símbolo", "TF", "Confluencia"]} minTrades={minTrades} idPrefix="confluencia_oscillators" />
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Generador dinámico de confluencias</h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>Escoge las piezas de la confluencia y Bitlog genera el ranking y la gráfica al momento.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {DIMENSION_OPTIONS.map(([dim, label]) => (
            <button key={dim} type="button" className="btn" onClick={() => toggleDynamicDim(dim)} style={{ ...renderButtonStyle, backgroundColor: dynamicDims.includes(dim) ? "#1f2937" : undefined }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 12 }}>
          <div className="field">
            <div className="label">Métrica de gráfica</div>
            <select className="input" value={dynamicMetric} onChange={(e) => setDynamicMetric(e.target.value as MetricKey)}>
              <option value="winRate">Win%</option>
              <option value="expectancy">Expectancy</option>
              <option value="trades">Trades</option>
            </select>
          </div>
          <div>
            <div className="label">Confluencia actual</div>
            <div style={{ fontSize: 13, paddingTop: 8 }}>{dynamicDims.join(" + ")}</div>
          </div>
        </div>
        <div style={{ width: "100%", height: dynamicChartHeight, marginBottom: 14 }}>
          {chartRows.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos suficientes con el mínimo de trades actual.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 30 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis type="number" stroke={AXIS} />
                <YAxis type="category" dataKey="key" stroke={AXIS} width={200} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip content={<MiniChartTooltipContent />} />
                <Legend />
                <Bar
                  dataKey="metric"
                  name={chartMetricLabel}
                  radius={[0, 6, 6, 0]}
                  barSize={22}
                  background={(props: any) => (
                    <rect x={props.x} y={props.y} width={props.width} height={props.height} fill={props.index % 2 === 0 ? "#151515" : "#0b0b0b"} />
                  )}
                >
                  {chartRows.map((entry) => (
                    <Cell key={entry.key} fill={Number(entry.metric) >= 0 ? GREEN : RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <PerfTable title="Ranking dinámico" rows={dynamicConfluence.filter((r) => r.trades >= minTrades)} columns={dynamicColumnLabels} minTrades={minTrades} idPrefix="ranking_dinamico" />
      </div>

      <TradeDetailTable trades={visibleTrades} />
    </div>
  );
}
