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

type TradeRow = {
  id: number;
  ticket: string | null;
  symbol: string | null;
  timeframe: string | null;
  side: string | null;
  session: string | null;
  dt_open_utc: string | null;
  dt_close_utc: string | null;
  volume: number | null;
  entry_price: number | null;
  exit_price: number | null;
  pips: number | null;
  rr_objetivo: string | null;
  pnl_usd_gross: number | null;
  pnl_usd_net: number | null;
  fee_usd: number | null;
  swap: number | null;
  ea: string | null;
  ea_signal: string | null;
  ea_score: number | null;
  ea_tp1: string | null;
  ea_tp2: string | null;
  ea_tp3: string | null;
  ea_sl1: string | null;
  patron: string | null;
  vela: string | null;
  tendencia: string | null;
  emocion: string | null;
  notes: string | null;
  close_reason: string | null;
};

type PerfRow = {
  key: string;
  parts: string[];
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgPnL: number;
  score: number;
};

type FilterPreset = {
  name: string;
  dateFrom: string;
  dateTo: string;
  ea: string;
  symbol: string;
  tf: string;
  side: string;
  session: string;
  emocion: string;
  patron: string;
  vela: string;
  day: string;
  hour: string;
};

type DimensionKey =
  | "ea"
  | "symbol"
  | "timeframe"
  | "session"
  | "day"
  | "hour"
  | "patron"
  | "emocion"
  | "side"
  | "vela";

type MetricKey = "pnl" | "winRate" | "trades";

type SortDir = "asc" | "desc";

type MetricSortKey = "trades" | "wins" | "losses" | "winRate" | "pnl";

type SortState =
  | { colType: "part"; colIndex: number; dir: SortDir }
  | { colType: "metric"; metric: MetricSortKey; dir: SortDir }
  | null;

type DetailSortKey =
  | "id"
  | "ticket"
  | "symbol"
  | "timeframe"
  | "side"
  | "ea"
  | "session"
  | "patron"
  | "vela"
  | "emocion"
  | "open"
  | "close"
  | "pnl";

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
const NEUTRAL = "#737373";
const GRID = "#2a2a2a";
const AXIS = "#cfcfcf";

const DIMENSION_OPTIONS: [DimensionKey, string][] = [
  ["ea", "EA"],
  ["symbol", "Símbolo"],
  ["timeframe", "TF"],
  ["session", "Sesión"],
  ["day", "Día"],
  ["hour", "Hora"],
  ["patron", "Patrón"],
  ["vela", "Vela"],
  ["emocion", "Emoción"],
  ["side", "Dirección"],
];

const DIMENSION_LABELS: Record<DimensionKey, string> = DIMENSION_OPTIONS.reduce(
  (acc, [k, l]) => {
    acc[k] = l;
    return acc;
  },
  {} as Record<DimensionKey, string>
);

const WEEKDAY_ORDER = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function safeNumber(n: number | null | undefined): number {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 0;
  return Number(n);
}

function fmtPct(p: number): string {
  if (!isFinite(p)) return "0%";
  return `${p.toFixed(1)}%`;
}

function fmtMoney(n: number): string {
  if (!isFinite(n)) return "$0.00";
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
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

function formatDurationHMS(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (v: number) => v.toString().padStart(2, "0");
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (minutes > 0) return `${pad(minutes)}:${pad(seconds)} min`;
  return `${seconds}s`;
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

function getTradeDimensionValue(t: TradeRow, dim: DimensionKey): string {
  if (dim === "ea") return (t.ea || "SIN_EA").trim() || "SIN_EA";
  if (dim === "symbol") return (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
  if (dim === "timeframe") return (t.timeframe || "SIN_TF").trim() || "SIN_TF";
  if (dim === "session") return (t.session || "SIN_SESION").trim() || "SIN_SESION";
  if (dim === "patron") return (t.patron || "SIN_PATRON").trim() || "SIN_PATRON";
  if (dim === "emocion") return (t.emocion || "SIN_EMOCION").trim() || "SIN_EMOCION";
  if (dim === "side") return (t.side || "SIN_DIRECCION").trim().toUpperCase() || "SIN_DIRECCION";
  if (dim === "vela") return (t.vela || "SIN_VELA").trim() || "SIN_VELA";
  if (dim === "hour") return t.dt_open_utc ? `${String(getHourMazatlan(t.dt_open_utc)).padStart(2, "0")}:00` : "SIN_HORA";
  if (dim === "day") return t.dt_open_utc ? getDayMazatlan(t.dt_open_utc) : "SIN_FECHA";
  return "—";
}

function aggregateTrades(trades: TradeRow[], dimensions: DimensionKey[]): PerfRow[] {
  const map = new Map<string, { parts: string[]; trades: number; wins: number; losses: number; pnl: number }>();

  trades.forEach((t) => {
    const parts = dimensions.map((d) => getTradeDimensionValue(t, d));
    const key = parts.join(" + ");
    if (!map.has(key)) map.set(key, { parts, trades: 0, wins: 0, losses: 0, pnl: 0 });
    const rec = map.get(key)!;
    const pnl = safeNumber(t.pnl_usd_gross);
    rec.trades += 1;
    rec.pnl += pnl;
    if (pnl > 0) rec.wins += 1;
    else if (pnl < 0) rec.losses += 1;
  });

  const rows: PerfRow[] = [];
  map.forEach((v, key) => {
    const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
    const avgPnL = v.trades > 0 ? v.pnl / v.trades : 0;
    const sampleFactor = Math.min(v.trades / 10, 1);
    const score = winRate * 0.55 + Math.max(Math.min(avgPnL * 10, 30), -30) + sampleFactor * 15;
    rows.push({ key, parts: v.parts, trades: v.trades, wins: v.wins, losses: v.losses, winRate, pnl: v.pnl, avgPnL, score });
  });

  rows.sort((a, b) => {
    if (b.pnl !== a.pnl) return b.pnl - a.pnl;
    return b.trades - a.trades;
  });
  return rows;
}

function getQualityBadge(row: PerfRow, minTrades: number) {
  if (row.trades < minTrades) return { label: "Muestra baja", bg: "#424242" };
  if (row.pnl > 0 && row.winRate >= 60) return { label: "Fuerte", bg: "#166534" };
  if (row.pnl > 0 && row.winRate >= 50) return { label: "Prometedor", bg: "#365314" };
  if (row.pnl < 0 && row.winRate < 50) return { label: "Evitar", bg: "#991b1b" };
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
    const headers = [...columns, "Trades", "Wins", "Losses", "Win%", "PnL", "Calidad"];
    const dataRows = displayRows.map((r) => [
      ...r.parts,
      r.trades,
      r.wins,
      r.losses,
      `${r.winRate.toFixed(1)}%`,
      r.pnl.toFixed(2),
      getQualityBadge(r, minTrades).label,
    ]);
    downloadCsv(`bitlog_${idPrefix}.csv`, headers, dataRows);
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
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("winRate")}>
                Win%{arrowFor("winRate")}
              </th>
              <th style={{ ...TH_STYLE, cursor: "pointer" }} onClick={() => handleSortMetric("pnl")}>
                PnL{arrowFor("pnl")}
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
                  <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                  <td style={{ ...rowStyle, color: isSelected ? "#fff" : row.pnl > 0 ? GREEN : row.pnl < 0 ? RED : "#ccc" }}>{fmtMoney(row.pnl)}</td>
                  <td style={rowStyle}>
                    <span style={{ ...BADGE_STYLE_BASE, backgroundColor: badge.bg, color: "#fff" }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
            {displayRows.length === 0 && (
              <tr>
                <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={columns.length + 6}>
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

/* ===================== Tabla de detalle de trades: sort + highlight ===================== */

function TradeDetailTable({ trades }: { trades: TradeRow[] }) {
  const [sortKey, setSortKey] = useState<DetailSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const getSortValue = (t: TradeRow, key: DetailSortKey): string | number => {
    switch (key) {
      case "id":
        return t.id;
      case "ticket":
        return t.ticket || "";
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
      case "patron":
        return t.patron || "";
      case "vela":
        return t.vela || "";
      case "emocion":
        return t.emocion || "";
      case "open":
        return t.dt_open_utc ? new Date(t.dt_open_utc).getTime() : 0;
      case "close":
        return t.dt_close_utc ? new Date(t.dt_close_utc).getTime() : 0;
      case "pnl":
        return safeNumber(t.pnl_usd_gross);
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
    { key: "ticket", label: "Ticket" },
    { key: "symbol", label: "Símbolo" },
    { key: "timeframe", label: "TF" },
    { key: "side", label: "Dirección" },
    { key: "ea", label: "EA" },
    { key: "session", label: "Sesión" },
    { key: "patron", label: "Patrón" },
    { key: "vela", label: "Vela" },
    { key: "emocion", label: "Emoción" },
    { key: "open", label: "Open" },
    { key: "close", label: "Close" },
    { key: "pnl", label: "PnL" },
  ];

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {sortKey && (
          <button type="button" title="Restaurar orden original" onClick={() => setSortKey(null)} style={ICON_BTN_STYLE}>
            ↺
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: 15 }}>Detalle de trades filtrados</h2>
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
              const pnl = safeNumber(t.pnl_usd_gross);
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
                  <td style={tdBase}>{t.ticket || "—"}</td>
                  <td style={tdBase}>{t.symbol || "—"}</td>
                  <td style={tdBase}>{t.timeframe || "—"}</td>
                  <td style={tdBase}>{(t.side || "—").toUpperCase()}</td>
                  <td style={tdBase}>{t.ea || "—"}</td>
                  <td style={tdBase}>{t.session || "—"}</td>
                  <td style={tdBase}>{t.patron || "—"}</td>
                  <td style={tdBase}>{t.vela || "—"}</td>
                  <td style={tdBase}>{t.emocion || "—"}</td>
                  <td style={tdBase}>{fmtDateShort(t.dt_open_utc)}</td>
                  <td style={tdBase}>{fmtDateShort(t.dt_close_utc)}</td>
                  <td style={{ ...tdBase, color: isSelected ? "#fff" : pnl > 0 ? GREEN : pnl < 0 ? RED : "#ccc" }}>{fmtMoney(pnl)}</td>
                  <td style={tdBase} onClick={(e) => e.stopPropagation()}>
                    <a href={`/trades/${t.id}`} className="btn link" style={{ fontSize: 11, padding: "3px 6px" }}>
                      Ver
                    </a>
                  </td>
                </tr>
              );
            })}
            {displayTrades.length === 0 && (
              <tr>
                <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={14}>
                  Sin trades en este filtro.
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
        {row.trades} tr. | {row.wins} W | {row.losses} L
      </div>
      <div style={{ marginTop: 2, color: row.pnl > 0 ? GREEN : row.pnl < 0 ? RED : "#ccc" }}>P&amp;L {fmtMoney(row.pnl)}</div>
    </div>
  );
}

export default function ChartsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);

  const [filterDateFromDraft, setFilterDateFromDraft] = useState("");
  const [filterDateToDraft, setFilterDateToDraft] = useState("");
  const [filterEaDraft, setFilterEaDraft] = useState("");
  const [filterSymbolDraft, setFilterSymbolDraft] = useState("");
  const [filterTfDraft, setFilterTfDraft] = useState("");
  const [filterSideDraft, setFilterSideDraft] = useState("");
  const [filterSessionDraft, setFilterSessionDraft] = useState("");
  const [filterEmocionDraft, setFilterEmocionDraft] = useState("");
  const [filterPatronDraft, setFilterPatronDraft] = useState("");
  const [filterVelaDraft, setFilterVelaDraft] = useState("");
  const [filterDayDraft, setFilterDayDraft] = useState("");
  const [filterHourDraft, setFilterHourDraft] = useState("");

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterEa, setFilterEa] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterEmocion, setFilterEmocion] = useState("");
  const [filterPatron, setFilterPatron] = useState("");
  const [filterVela, setFilterVela] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterHour, setFilterHour] = useState("");

  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetName, setSelectedPresetName] = useState("");

  const [minTrades, setMinTrades] = useState(3);
  const [dynamicMetric, setDynamicMetric] = useState<MetricKey>("pnl");
  const [dynamicDims, setDynamicDims] = useState<DimensionKey[]>(["ea", "symbol", "timeframe"]);

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
          .from("trades")
          .select("*")
          .eq("user_id", uid)
          .order("dt_open_utc", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .limit(2000);
        if (qErr) throw qErr;
        if (!cancelled) setTrades((data || []) as unknown as TradeRow[]);
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
      const raw = window.localStorage.getItem("bitlog_chart_presets");
      if (raw) {
        const parsed = JSON.parse(raw) as FilterPreset[];
        if (Array.isArray(parsed)) setPresets(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("bitlog_chart_presets", JSON.stringify(presets));
    } catch {}
  }, [presets]);

  const allEAs = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.ea?.trim()) s.add(t.ea.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allSymbols = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.symbol?.trim()) s.add(t.symbol.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allTimeframes = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.timeframe?.trim()) s.add(t.timeframe.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allSessions = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.session?.trim()) s.add(t.session.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allEmociones = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.emocion?.trim()) s.add(t.emocion.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allPatrones = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.patron?.trim()) s.add(t.patron.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allVelas = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.vela?.trim()) s.add(t.vela.trim());
    });
    return Array.from(s).sort();
  }, [trades]);

  const allDays = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.dt_open_utc) s.add(getDayMazatlan(t.dt_open_utc));
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
      if (t.dt_open_utc) s.add(`${String(getHourMazatlan(t.dt_open_utc)).padStart(2, "0")}:00`);
    });
    return Array.from(s).sort();
  }, [trades]);

  const visibleTrades = useMemo(() => {
    let list = trades.slice();
    if (filterDateFrom) {
      const dFrom = new Date(filterDateFrom + "T00:00:00");
      list = list.filter((t) => !!t.dt_open_utc && new Date(t.dt_open_utc) >= dFrom);
    }
    if (filterDateTo) {
      const dTo = new Date(filterDateTo + "T23:59:59");
      list = list.filter((t) => !!t.dt_open_utc && new Date(t.dt_open_utc) <= dTo);
    }
    if (filterEa) list = list.filter((t) => (t.ea || "").toUpperCase() === filterEa.toUpperCase());
    if (filterSymbol) list = list.filter((t) => (t.symbol || "").toUpperCase() === filterSymbol.toUpperCase());
    if (filterTf) list = list.filter((t) => (t.timeframe || "").toUpperCase() === filterTf.toUpperCase());
    if (filterSide) list = list.filter((t) => (t.side || "").toUpperCase() === filterSide.toUpperCase());
    if (filterSession) list = list.filter((t) => (t.session || "").toUpperCase() === filterSession.toUpperCase());
    if (filterEmocion) list = list.filter((t) => (t.emocion || "").toUpperCase() === filterEmocion.toUpperCase());
    if (filterPatron) list = list.filter((t) => (t.patron || "").toUpperCase() === filterPatron.toUpperCase());
    if (filterVela) list = list.filter((t) => (t.vela || "").toUpperCase() === filterVela.toUpperCase());
    if (filterDay) list = list.filter((t) => (t.dt_open_utc ? getDayMazatlan(t.dt_open_utc) : "SIN_FECHA") === filterDay);
    if (filterHour)
      list = list.filter(
        (t) => (t.dt_open_utc ? `${String(getHourMazatlan(t.dt_open_utc)).padStart(2, "0")}:00` : "SIN_HORA") === filterHour
      );
    return list;
  }, [
    trades,
    filterDateFrom,
    filterDateTo,
    filterEa,
    filterSymbol,
    filterTf,
    filterSide,
    filterSession,
    filterEmocion,
    filterPatron,
    filterVela,
    filterDay,
    filterHour,
  ]);

  const summary = useMemo(() => {
    const total = visibleTrades.length;
    let wins = 0;
    let losses = 0;
    let pnl = 0;
    visibleTrades.forEach((t) => {
      const v = safeNumber(t.pnl_usd_gross);
      pnl += v;
      if (v > 0) wins++;
      else if (v < 0) losses++;
    });
    return {
      total,
      wins,
      losses,
      winRate: total ? (wins / total) * 100 : 0,
      pnl,
      avgPnL: total ? pnl / total : 0,
    };
  }, [visibleTrades]);

  const avgDurationMs = useMemo(() => {
    let totalMs = 0;
    let count = 0;
    visibleTrades.forEach((t) => {
      if (!t.dt_open_utc || !t.dt_close_utc) return;
      const open = new Date(t.dt_open_utc).getTime();
      const close = new Date(t.dt_close_utc).getTime();
      if (!Number.isNaN(open) && !Number.isNaN(close) && close > open) {
        totalMs += close - open;
        count++;
      }
    });
    return count ? totalMs / count : 0;
  }, [visibleTrades]);

  const perfByEA = useMemo(() => aggregateTrades(visibleTrades, ["ea"]), [visibleTrades]);
  const perfBySymbol = useMemo(() => aggregateTrades(visibleTrades, ["symbol"]), [visibleTrades]);
  const perfByTimeframe = useMemo(() => aggregateTrades(visibleTrades, ["timeframe"]), [visibleTrades]);
  const perfBySession = useMemo(() => aggregateTrades(visibleTrades, ["session"]), [visibleTrades]);
  const perfByDay = useMemo(() => aggregateTrades(visibleTrades, ["day"]), [visibleTrades]);
  const perfByHour = useMemo(() => aggregateTrades(visibleTrades, ["hour"]), [visibleTrades]);
  const perfByPatron = useMemo(() => aggregateTrades(visibleTrades, ["patron"]), [visibleTrades]);
  const perfByEmocion = useMemo(() => aggregateTrades(visibleTrades, ["emocion"]), [visibleTrades]);
  const perfBySide = useMemo(() => aggregateTrades(visibleTrades, ["side"]), [visibleTrades]);

  const confluenceBase = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe"]), [visibleTrades]);
  const confluencePatron = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe", "patron"]), [visibleTrades]);
  const confluenceVela = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe", "vela"]), [visibleTrades]);
  const confluenceEmocion = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe", "emocion"]), [visibleTrades]);
  const confluenceSession = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe", "session"]), [visibleTrades]);
  const confluenceSide = useMemo(() => aggregateTrades(visibleTrades, ["ea", "symbol", "timeframe", "side"]), [visibleTrades]);

  const dynamicConfluence = useMemo(() => aggregateTrades(visibleTrades, dynamicDims), [visibleTrades, dynamicDims]);
  const dynamicColumnLabels = useMemo(() => dynamicDims.map((d) => DIMENSION_LABELS[d]), [dynamicDims]);

  const topBest = useMemo(() => dynamicConfluence.filter((r) => r.trades >= minTrades && r.pnl > 0).slice(0, 5), [dynamicConfluence, minTrades]);
  const topWorst = useMemo(
    () =>
      dynamicConfluence
        .filter((r) => r.trades >= minTrades && r.pnl < 0)
        .slice()
        .sort((a, b) => a.pnl - b.pnl)
        .slice(0, 5),
    [dynamicConfluence, minTrades]
  );

  const equityCurve = useMemo(() => {
    let acc = 0;
    return visibleTrades
      .slice()
      .filter((t) => !!t.dt_open_utc)
      .sort((a, b) => new Date(a.dt_open_utc || "").getTime() - new Date(b.dt_open_utc || "").getTime())
      .map((t, idx) => {
        acc += safeNumber(t.pnl_usd_gross);
        return { n: idx + 1, pnl: acc, label: fmtDateShort(t.dt_open_utc) };
      });
  }, [visibleTrades]);

  const pieWinLossData = useMemo(
    () => [
      { name: "Wins", value: summary.wins },
      { name: "Losses", value: summary.losses },
      { name: "Neutros", value: Math.max(summary.total - summary.wins - summary.losses, 0) },
    ],
    [summary]
  );

  const applyQuickPreset = (type: "today" | "7d" | "30d" | "ny") => {
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
      const ny = allSessions.find((s) => s.toUpperCase().includes("NY")) || allSessions.find((s) => s.toUpperCase().includes("NEW YORK")) || "";
      setFilterSessionDraft(ny);
      setFilterSession(ny);
    }
  };

  const handleApplyGlobalFilters = () => {
    setFilterDateFrom(filterDateFromDraft);
    setFilterDateTo(filterDateToDraft);
    setFilterEa(filterEaDraft);
    setFilterSymbol(filterSymbolDraft);
    setFilterTf(filterTfDraft);
    setFilterSide(filterSideDraft);
    setFilterSession(filterSessionDraft);
    setFilterEmocion(filterEmocionDraft);
    setFilterPatron(filterPatronDraft);
    setFilterVela(filterVelaDraft);
    setFilterDay(filterDayDraft);
    setFilterHour(filterHourDraft);
  };

  const handleClearGlobalFilters = () => {
    setFilterDateFromDraft("");
    setFilterDateToDraft("");
    setFilterEaDraft("");
    setFilterSymbolDraft("");
    setFilterTfDraft("");
    setFilterSideDraft("");
    setFilterSessionDraft("");
    setFilterEmocionDraft("");
    setFilterPatronDraft("");
    setFilterVelaDraft("");
    setFilterDayDraft("");
    setFilterHourDraft("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterEa("");
    setFilterSymbol("");
    setFilterTf("");
    setFilterSide("");
    setFilterSession("");
    setFilterEmocion("");
    setFilterPatron("");
    setFilterVela("");
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
      ea: filterEaDraft,
      symbol: filterSymbolDraft,
      tf: filterTfDraft,
      side: filterSideDraft,
      session: filterSessionDraft,
      emocion: filterEmocionDraft,
      patron: filterPatronDraft,
      vela: filterVelaDraft,
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
    setFilterEaDraft(p.ea);
    setFilterSymbolDraft(p.symbol);
    setFilterTfDraft(p.tf);
    setFilterSideDraft(p.side);
    setFilterSessionDraft(p.session);
    setFilterEmocionDraft(p.emocion || "");
    setFilterPatronDraft(p.patron || "");
    setFilterVelaDraft(p.vela || "");
    setFilterDayDraft(p.day || "");
    setFilterHourDraft(p.hour || "");
    setFilterDateFrom(p.dateFrom);
    setFilterDateTo(p.dateTo);
    setFilterEa(p.ea);
    setFilterSymbol(p.symbol);
    setFilterTf(p.tf);
    setFilterSide(p.side);
    setFilterSession(p.session);
    setFilterEmocion(p.emocion || "");
    setFilterPatron(p.patron || "");
    setFilterVela(p.vela || "");
    setFilterDay(p.day || "");
    setFilterHour(p.hour || "");
  };

  const handleExportCsv = () => {
    if (!visibleTrades.length) return;
    const headers = [
      "id", "ticket", "symbol", "timeframe", "session", "dt_open_utc", "dt_close_utc", "side", "volume", "entry_price",
      "exit_price", "pips", "rr_objetivo", "pnl_usd_gross", "pnl_usd_net", "fee_usd", "swap", "close_reason", "ea",
      "ea_signal", "ea_score", "ea_tp1", "ea_tp2", "ea_tp3", "ea_sl1", "patron", "vela", "tendencia", "emocion", "notes",
    ];
    const rows = visibleTrades.map((t) =>
      [
        t.id, t.ticket, t.symbol, t.timeframe, t.session, t.dt_open_utc, t.dt_close_utc, t.side, t.volume, t.entry_price,
        t.exit_price, t.pips, t.rr_objetivo, t.pnl_usd_gross, t.pnl_usd_net, t.fee_usd, t.swap, t.close_reason, t.ea,
        t.ea_signal, t.ea_score, t.ea_tp1, t.ea_tp2, t.ea_tp3, t.ea_sl1, t.patron, t.vela, t.tendencia, t.emocion, t.notes,
      ].map(csvEscape).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bitlog_charts_filtrado.csv";
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

  const chartMetricLabel = dynamicMetric === "pnl" ? "PnL" : dynamicMetric === "winRate" ? "Win%" : "Trades";
  const chartMetricFormatter = (value: any) =>
    dynamicMetric === "pnl" ? fmtMoney(Number(value)) : dynamicMetric === "winRate" ? fmtPct(Number(value)) : Number(value);
  const chartRows = dynamicConfluence.filter((r) => r.trades >= minTrades).slice(0, 12).map((r) => ({ ...r, metric: r[dynamicMetric] }));
  const dynamicChartHeight = Math.max(320, chartRows.length * 42);

  const renderButtonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", fontSize: 12, borderRadius: 0, minWidth: 0, width: "auto" };

  const renderMiniChart = (title: string, rows: PerfRow[], metric: MetricKey = "pnl") => {
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
                <Bar dataKey="metric" name={metric === "pnl" ? "PnL" : metric === "winRate" ? "Win%" : "Trades"} radius={[6, 6, 0, 0]}>
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
          Charts — Dashboard &amp; Confluencias
        </h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 13, marginBottom: 8 }}>
          Gráficas modernas rojo/verde, diagnóstico por categoría, confluencias fijas y generador dinámico on demand.
        </p>
        <div style={{ fontSize: 13, marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={handleApplyGlobalFilters} style={renderButtonStyle}>Aplicar filtros</button>
          <button type="button" className="btn" onClick={handleClearGlobalFilters} style={renderButtonStyle}>Limpiar filtros</button>
          <button type="button" className="btn" onClick={handleExportCsv} style={renderButtonStyle}>Exportar CSV filtrados</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("today")} style={renderButtonStyle}>Hoy</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("7d")} style={renderButtonStyle}>Últimos 7 días</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("30d")} style={renderButtonStyle}>Últimos 30 días</button>
          <button type="button" className="btn" onClick={() => applyQuickPreset("ny")} style={renderButtonStyle}>Solo NY Session</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={{ ...BADGE_STYLE_BASE, backgroundColor: summary.winRate >= 60 ? "#166534" : summary.winRate >= 50 ? "#374151" : "#991b1b", color: "#fff" }}>
            Winrate global: {fmtPct(summary.winRate)}
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
          <FilterDropdown label="EA" value={filterEaDraft} options={allEAs} onChange={setFilterEaDraft} />
          <FilterDropdown label="Símbolo" value={filterSymbolDraft} options={allSymbols} onChange={setFilterSymbolDraft} />
          <FilterDropdown label="Timeframe" value={filterTfDraft} options={allTimeframes} onChange={setFilterTfDraft} />
          <FilterDropdown label="Dirección" value={filterSideDraft} options={["BUY", "SELL"]} onChange={setFilterSideDraft} placeholder="(Todas)" />
          <FilterDropdown label="Sesión" value={filterSessionDraft} options={allSessions} onChange={setFilterSessionDraft} placeholder="(Todas)" />
          <FilterDropdown label="Emoción" value={filterEmocionDraft} options={allEmociones} onChange={setFilterEmocionDraft} placeholder="(Todas)" />
          <FilterDropdown label="Patrón" value={filterPatronDraft} options={allPatrones} onChange={setFilterPatronDraft} placeholder="(Todos)" />
          <FilterDropdown label="Vela" value={filterVelaDraft} options={allVelas} onChange={setFilterVelaDraft} placeholder="(Todas)" />
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
              <option value={1000}>1000</option>
            </select>
          </div>

          <div className="field">
            <div className="label">Nombre de preset</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input" type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Setup XAU M15" />
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
              <div><div className="label">Trades</div><div style={{ fontSize: 18, fontWeight: 700 }}>{summary.total}</div></div>
              <div><div className="label">Wins</div><div style={{ fontSize: 18, fontWeight: 700, color: GREEN }}>{summary.wins}</div></div>
              <div><div className="label">Losses</div><div style={{ fontSize: 18, fontWeight: 700, color: RED }}>{summary.losses}</div></div>
              <div><div className="label">Win rate</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(summary.winRate)}</div></div>
              <div><div className="label">PnL total</div><div style={{ fontSize: 18, fontWeight: 700, color: summary.pnl > 0 ? GREEN : summary.pnl < 0 ? RED : "#ccc" }}>{fmtMoney(summary.pnl)}</div></div>
              <div><div className="label">PnL promedio</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtMoney(summary.avgPnL)}</div></div>
              <div><div className="label">Duración promedio</div><div style={{ fontSize: 18, fontWeight: 700 }}>{formatDurationHMS(avgDurationMs)}</div></div>
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
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Equity curve — PnL acumulado</h2>
          {equityCurve.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos.</p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="n" stroke={AXIS} tick={{ fontSize: 11 }} />
                  <YAxis stroke={AXIS} />
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} formatter={(value: any) => fmtMoney(Number(value))} labelFormatter={(label) => `Trade #${label}`} />
                  <Line type="monotone" dataKey="pnl" name="PnL acumulado" stroke={summary.pnl >= 0 ? GREEN : RED} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Wins vs Losses</h2>
          {summary.total === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos.</p>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
                  <Legend />
                  <Pie data={pieWinLossData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>
                    {[GREEN, RED, NEUTRAL].map((c) => (
                      <Cell key={c} fill={c} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 18, margin: "4px 0 12px" }}>Dónde gano / dónde pierdo</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        {renderMiniChart("PnL por EA", perfByEA)}
        {renderMiniChart("PnL por símbolo", perfBySymbol)}
        {renderMiniChart("PnL por timeframe", perfByTimeframe)}
        {renderMiniChart("PnL por sesión", perfBySession)}
        {renderMiniChart("PnL por día", perfByDay)}
        {renderMiniChart("PnL por hora", perfByHour)}
        {renderMiniChart("PnL por patrón", perfByPatron)}
        {renderMiniChart("PnL por emoción", perfByEmocion)}
        {renderMiniChart("PnL por dirección BUY/SELL", perfBySide)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        <PerfTable title="Performance por EA" rows={perfByEA} columns={["EA"]} minTrades={minTrades} idPrefix="perf_ea" />
        <PerfTable title="Performance por símbolo" rows={perfBySymbol} columns={["Símbolo"]} minTrades={minTrades} idPrefix="perf_symbol" />
        <PerfTable title="Performance por timeframe" rows={perfByTimeframe} columns={["TF"]} minTrades={minTrades} idPrefix="perf_tf" />
        <PerfTable title="Performance por sesión" rows={perfBySession} columns={["Sesión"]} minTrades={minTrades} idPrefix="perf_session" />
        <PerfTable title="Performance por día" rows={perfByDay} columns={["Día"]} minTrades={minTrades} idPrefix="perf_day" />
        <PerfTable title="Performance por hora" rows={perfByHour} columns={["Hora"]} minTrades={minTrades} idPrefix="perf_hour" />
        <PerfTable title="Performance por patrón" rows={perfByPatron} columns={["Patrón"]} minTrades={minTrades} idPrefix="perf_patron" />
        <PerfTable title="Performance por emoción" rows={perfByEmocion} columns={["Emoción"]} minTrades={minTrades} idPrefix="perf_emocion" />
        <PerfTable title="Performance por dirección" rows={perfBySide} columns={["Dirección"]} minTrades={minTrades} idPrefix="perf_side" />
      </div>

      <h2 style={{ fontSize: 18, margin: "4px 0 12px" }}>Confluencias fijas</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 16 }}>
        <PerfTable title="EA + símbolo + TF" rows={confluenceBase} columns={["EA", "Símbolo", "TF"]} minTrades={minTrades} idPrefix="confluencia_base" />
        <PerfTable title="EA + símbolo + TF + patrón" rows={confluencePatron} columns={["EA", "Símbolo", "TF", "Patrón"]} minTrades={minTrades} idPrefix="confluencia_patron" />
        <PerfTable title="EA + símbolo + TF + vela" rows={confluenceVela} columns={["EA", "Símbolo", "TF", "Vela"]} minTrades={minTrades} idPrefix="confluencia_vela" />
        <PerfTable title="EA + símbolo + TF + emoción" rows={confluenceEmocion} columns={["EA", "Símbolo", "TF", "Emoción"]} minTrades={minTrades} idPrefix="confluencia_emocion" />
        <PerfTable title="EA + símbolo + TF + sesión" rows={confluenceSession} columns={["EA", "Símbolo", "TF", "Sesión"]} minTrades={minTrades} idPrefix="confluencia_sesion" />
        <PerfTable title="EA + símbolo + TF + dirección BUY/SELL" rows={confluenceSide} columns={["EA", "Símbolo", "TF", "Dirección"]} minTrades={minTrades} idPrefix="confluencia_side" />
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Generador dinámico de confluencias</h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>Escoge las piezas de la confluencia y Bitlog genera el ranking y la gráfica al momento. Sin redundancia, sin circo.</p>
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
              <option value="pnl">PnL</option>
              <option value="winRate">Win%</option>
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
