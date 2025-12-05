"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
  // --- Campos extra para export PRO ---
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
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
};

type ComboRow = {
  ea: string;
  symbol: string;
  timeframe: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
};

type ConfluenceRow = {
  ea: string;
  symbol: string;
  timeframe: string;
  extra: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
};

type DayOfWeekRow = {
  dayIndex: number;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
};

type CloseReasonRow = {
  reason: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
};

type HourOfDayRow = {
  hour: number;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
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
};

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

function safeNumber(n: number | null | undefined): number {
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Number(n);
}

function fmtPct(p: number): string {
  if (!isFinite(p)) return "0%";
  return `${p.toFixed(1)}%`;
}

function fmtMoney(n: number): string {
  if (!isFinite(n)) return "$0.00";
  const sign = n >= 0 ? "" : "-";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
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

// Formato HH:MM:SS para duración promedio
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

// Heatmap color para EA × TF
function getHeatCellColor(winRate: number, trades: number): string {
  if (trades === 0) return "#111111";
  if (trades < 3) return "#222222";
  if (winRate >= 70) return "#1b5e20";
  if (winRate >= 55) return "#33691e";
  if (winRate >= 45) return "#424242";
  if (winRate >= 30) return "#b71c1c";
  return "#880e4f";
}

// Hora local Mazatlán a partir de dt_open_utc
function getHourMazatlan(dateStr: string): number {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 0;
    const formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Mazatlan",
    });
    const hourStr = formatter.format(d);
    const h = parseInt(hourStr, 10);
    if (Number.isNaN(h)) return 0;
    return h;
  } catch {
    return 0;
  }
}

// Fecha YYYY-MM-DD en Mazatlán
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
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* =========================
   TOP NAV (estilo Charts)
   ========================= */
function TopNav() {
  return (
    <nav className="topnav" style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <a className="btn-nav" href="/">Home</a>
        <a className="btn-nav" href="/trades">Trades</a>
        <a className="btn-nav" href="/trades/new">New</a>
        <a className="btn-nav" href="/field-edits">Field Edits</a>
        <a className="btn-nav" href="/import">Import</a>
        <a className="btn-nav" href="/charts">Charts</a>
        <a className="btn-nav" href="/checklist">Checklist</a>
      </div>
    </nav>
  );
}

export default function ChartsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);

  // Filtros globales (draft + aplicados)
  const [filterDateFromDraft, setFilterDateFromDraft] = useState("");
  const [filterDateToDraft, setFilterDateToDraft] = useState("");
  const [filterEaDraft, setFilterEaDraft] = useState("");
  const [filterSymbolDraft, setFilterSymbolDraft] = useState("");
  const [filterTfDraft, setFilterTfDraft] = useState("");
  const [filterSideDraft, setFilterSideDraft] = useState("");
  const [filterSessionDraft, setFilterSessionDraft] = useState("");

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterEa, setFilterEa] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterTf, setFilterTf] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [filterSession, setFilterSession] = useState("");

  // Presets de filtros
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetName, setSelectedPresetName] = useState("");

  // Filtro de confluencias
  const [confEa, setConfEa] = useState("");
  const [confSymbol, setConfSymbol] = useState("");
  const [confTf, setConfTf] = useState("");
  const [confSession, setConfSession] = useState("");
  const [confEmocion, setConfEmocion] = useState("");
  const [confPatron, setConfPatron] = useState("");
  const [confVela, setConfVela] = useState("");
  const [confFiltersApplied, setConfFiltersApplied] = useState(false);

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

        if (!cancelled) {
          setTrades((data || []) as unknown as TradeRow[]);
        }
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

  // Cargar presets desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("bitlog_chart_presets");
      if (raw) {
        const parsed = JSON.parse(raw) as FilterPreset[];
        if (Array.isArray(parsed)) {
          setPresets(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Guardar presets en localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("bitlog_chart_presets", JSON.stringify(presets));
    } catch {
      // ignore
    }
  }, [presets]);

  // Catálogos
  const allEAs = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.ea) s.add(t.ea);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allSymbols = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.symbol) s.add(t.symbol);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allTimeframes = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.timeframe) s.add(t.timeframe);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allSessions = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.session) s.add(t.session);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allEmociones = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.emocion) s.add(t.emocion);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allPatrones = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.patron) s.add(t.patron);
    });
    return Array.from(s).sort();
  }, [trades]);

  const allVelas = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.vela) s.add(t.vela);
    });
    return Array.from(s).sort();
  }, [trades]);

  // Global filters apply / clear
  const handleApplyGlobalFilters = () => {
    setFilterDateFrom(filterDateFromDraft);
    setFilterDateTo(filterDateToDraft);
    setFilterEa(filterEaDraft);
    setFilterSymbol(filterSymbolDraft);
    setFilterTf(filterTfDraft);
    setFilterSide(filterSideDraft);
    setFilterSession(filterSessionDraft);
  };

  const handleClearGlobalFilters = () => {
    setFilterDateFromDraft("");
    setFilterDateToDraft("");
    setFilterEaDraft("");
    setFilterSymbolDraft("");
    setFilterTfDraft("");
    setFilterSideDraft("");
    setFilterSessionDraft("");

    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterEa("");
    setFilterSymbol("");
    setFilterTf("");
    setFilterSide("");
    setFilterSession("");
  };

  // Presets rápidos (Hoy, 7d, 30d, Solo NY)
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
    } else if (type === "ny") {
      const nyOption =
        allSessions.find((s) => s.toUpperCase().includes("NY")) ||
        allSessions.find((s) => s.toUpperCase().includes("NEW YORK")) ||
        "";
      if (nyOption) {
        setFilterSessionDraft(nyOption);
        setFilterSession(nyOption);
      }
    }
  };

  // Guardar preset favorito
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
    };

    setPresets((prev) => {
      const others = prev.filter((p) => p.name !== name);
      return [...others, newPreset];
    });

    setSelectedPresetName(name);
  };

  const handleLoadPreset = () => {
    const name = selectedPresetName;
    if (!name) return;

    const preset = presets.find((p) => p.name === name);
    if (!preset) return;

    setFilterDateFromDraft(preset.dateFrom);
    setFilterDateToDraft(preset.dateTo);
    setFilterEaDraft(preset.ea);
    setFilterSymbolDraft(preset.symbol);
    setFilterTfDraft(preset.tf);
    setFilterSideDraft(preset.side);
    setFilterSessionDraft(preset.session);

    setFilterDateFrom(preset.dateFrom);
    setFilterDateTo(preset.dateTo);
    setFilterEa(preset.ea);
    setFilterSymbol(preset.symbol);
    setFilterTf(preset.tf);
    setFilterSide(preset.side);
    setFilterSession(preset.session);
  };

  // Visible trades según filtros globales
  const visibleTrades = useMemo(() => {
    let list = trades.slice();

    if (filterDateFrom) {
      const dFrom = new Date(filterDateFrom + "T00:00:00");
      list = list.filter((t) => {
        if (!t.dt_open_utc) return false;
        const d = new Date(t.dt_open_utc);
        return d >= dFrom;
      });
    }

    if (filterDateTo) {
      const dTo = new Date(filterDateTo + "T23:59:59");
      list = list.filter((t) => {
        if (!t.dt_open_utc) return false;
        const d = new Date(t.dt_open_utc);
        return d <= dTo;
      });
    }

    if (filterEa) {
      list = list.filter((t) => (t.ea || "").toUpperCase() === filterEa.toUpperCase());
    }
    if (filterSymbol) {
      list = list.filter(
        (t) => (t.symbol || "").toUpperCase() === filterSymbol.toUpperCase()
      );
    }
    if (filterTf) {
      list = list.filter(
        (t) => (t.timeframe || "").toUpperCase() === filterTf.toUpperCase()
      );
    }
    if (filterSide) {
      list = list.filter(
        (t) => (t.side || "").toUpperCase() === filterSide.toUpperCase()
      );
    }
    if (filterSession) {
      list = list.filter(
        (t) => (t.session || "").toUpperCase() === filterSession.toUpperCase()
      );
    }

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
  ]);

  /* ============================================================
   * [BLOCK 1] Export CSV PRO – todas las columnas clave del trade
   * ============================================================ */
  const handleExportCsv = () => {
    if (!visibleTrades.length) return;

   const headers = [
  "id",
  "ticket",
  "symbol",
  "timeframe",
  "session",
  "dt_open_utc",
  "dt_close_utc",
  "side",
  "volume",
  "entry_price",
  "exit_price",
  "pips",
  "rr_objetivo",
  "pnl_usd_gross",
  "pnl_usd_net",
  "fee_usd",
  "swap",
  "close_reason",
  "ea",
  "ea_signal",
  "ea_score",
  "ea_tp1",
  "ea_tp2",
  "ea_tp3",
  "ea_sl1",
  "patron",
  "vela",
  "tendencia",
  "emocion",
  "notes",
  ];




    const escapeCell = (value: any) => {
      if (value === null || value === undefined) return "";
      const s = String(value);
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = visibleTrades.map((t) =>
      [
        t.id,
        t.ticket ?? "",
        t.symbol ?? "",
        t.timeframe ?? "",
        t.session ?? "",
        t.dt_open_utc ?? "",
        t.dt_close_utc ?? "",
        t.side ?? "",
        t.volume ?? "",
        t.entry_price ?? "",
        t.exit_price ?? "",
        t.pips ?? "",
        t.rr_objetivo ?? "",
        t.pnl_usd_gross ?? "",
        t.pnl_usd_net ?? "",
        t.fee_usd ?? "",
        t.swap ?? "",
        t.close_reason ?? "", // 👈 AQUÍ LO AGREGAMOS
        t.ea ?? "",
        t.ea_signal ?? "",
        t.ea_score ?? "",
        t.ea_tp1 ?? "",
        t.ea_tp2 ?? "",
        t.ea_tp3 ?? "",
        t.ea_sl1 ?? "",
        t.patron ?? "",
        t.vela ?? "",
        t.tendencia ?? "",
        t.emocion ?? "",
        t.notes ?? "",
      ]
        .map(escapeCell)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bitlog_trades_export_pro.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Estadísticas globales
  const summary = useMemo(() => {
    const total = visibleTrades.length;
    if (total === 0) {
      return {
        total,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnl: 0,
        avgPnL: 0,
      };
    }

    let wins = 0;
    let losses = 0;
    let pnl = 0;

    visibleTrades.forEach((t) => {
      const v = safeNumber(t.pnl_usd_gross);
      pnl += v;
      if (v > 0) wins++;
      else if (v < 0) losses++;
    });

    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const avgPnL = total > 0 ? pnl / total : 0;

    return { total, wins, losses, winRate, pnl, avgPnL };
  }, [visibleTrades]);

  // Duración promedio de trades (cerrados)
  const avgDurationMs = useMemo(() => {
    let totalMs = 0;
    let count = 0;
    visibleTrades.forEach((t) => {
      if (!t.dt_open_utc || !t.dt_close_utc) return;
      const dOpen = new Date(t.dt_open_utc);
      const dClose = new Date(t.dt_close_utc);
      if (Number.isNaN(dOpen.getTime()) || Number.isNaN(dClose.getTime())) return;
      const diff = dClose.getTime() - dOpen.getTime();
      if (diff > 0) {
        totalMs += diff;
        count++;
      }
    });
    if (count === 0) return 0;
    return totalMs / count;
  }, [visibleTrades]);

  // Performance por EA, símbolo, timeframe
  const perfByEA = useMemo<PerfRow[]>(() => {
    const map = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>();

    visibleTrades.forEach((t) => {
      const key = (t.ea || "SIN_EA").trim() || "SIN_EA";
      if (!map.has(key)) {
        map.set(key, { trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: PerfRow[] = [];
    map.forEach((v, k) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        key: k,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  const perfBySymbol = useMemo<PerfRow[]>(() => {
    const map = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>();

    visibleTrades.forEach((t) => {
      const key = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      if (!map.has(key)) {
        map.set(key, { trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: PerfRow[] = [];
    map.forEach((v, k) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        key: k,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  const perfByTimeframe = useMemo<PerfRow[]>(() => {
    const map = new Map<string, { trades: number; wins: number; losses: number; pnl: number }>();

    visibleTrades.forEach((t) => {
      const key = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      if (!map.has(key)) {
        map.set(key, { trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: PerfRow[] = [];
    map.forEach((v, k) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        key: k,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  // Performance por día de la semana
  const perfByDayOfWeek = useMemo<DayOfWeekRow[]>(() => {
    const base: DayOfWeekRow[] = [
      { dayIndex: 0, label: "Domingo", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 1, label: "Lunes", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 2, label: "Martes", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 3, label: "Miércoles", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 4, label: "Jueves", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 5, label: "Viernes", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
      { dayIndex: 6, label: "Sábado", trades: 0, wins: 0, losses: 0, winRate: 0, pnl: 0 },
    ];

    visibleTrades.forEach((t) => {
      if (!t.dt_open_utc) return;
      const d = new Date(t.dt_open_utc);
      if (Number.isNaN(d.getTime())) return;
      const idx = d.getDay(); // 0-6
      const row = base[idx];
      row.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      row.pnl += v;
      if (v > 0) row.wins += 1;
      else if (v < 0) row.losses += 1;
    });

    base.forEach((r) => {
      r.winRate = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
    });

    // Orden: Lunes a Domingo
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => base[i]);
  }, [visibleTrades]);

  // Performance por hora del día (Mazatlán)
  const perfByHourOfDay = useMemo<HourOfDayRow[]>(() => {
    const base: HourOfDayRow[] = [];
    for (let h = 0; h < 24; h++) {
      base.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnl: 0,
      });
    }

    visibleTrades.forEach((t) => {
      if (!t.dt_open_utc) return;
      const hour = getHourMazatlan(t.dt_open_utc);
      const row = base[hour] ?? base[0];
      row.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      row.pnl += v;
      if (v > 0) row.wins += 1;
      else if (v < 0) row.losses += 1;
    });

    base.forEach((r) => {
      r.winRate = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
    });

    return base;
  }, [visibleTrades]);

  // Desglose por motivo de cierre
  const perfByCloseReason = useMemo<CloseReasonRow[]>(() => {
    const map = new Map<
      string,
      { trades: number; wins: number; losses: number; pnl: number }
    >();

    visibleTrades.forEach((t) => {
      const reason = ((t.close_reason || "UNKNOWN") as string).toUpperCase();
      if (!map.has(reason)) {
        map.set(reason, { trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(reason)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: CloseReasonRow[] = [];
    map.forEach((v, k) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        reason: k,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  // Confluencias EA + símbolo + timeframe
  const combosEA_Symbol_TF = useMemo<ComboRow[]>(() => {
    const map = new Map<
      string,
      {
        ea: string;
        symbol: string;
        timeframe: string;
        trades: number;
        wins: number;
        losses: number;
        pnl: number;
      }
    >();

    visibleTrades.forEach((t) => {
      const ea = (t.ea || "SIN_EA").trim() || "SIN_EA";
      const symbol = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      const tf = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      const key = `${ea}__${symbol}__${tf}`;
      if (!map.has(key)) {
        map.set(key, { ea, symbol, timeframe: tf, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: ComboRow[] = [];
    map.forEach((v) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        ea: v.ea,
        symbol: v.symbol,
        timeframe: v.timeframe,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  // Top confluencias (modo sniper)
  const topSniperCombos = useMemo(() => {
    const minTrades = 5;
    const filtered = combosEA_Symbol_TF.filter((c) => c.trades >= minTrades);
    filtered.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.trades - a.trades;
    });
    return filtered.slice(0, 10);
  }, [combosEA_Symbol_TF]);

  // Datos para gráficas
  const chartDataSymbolPnL = useMemo(
    () =>
      perfBySymbol.map((row) => ({
        symbol: row.key,
        pnl: row.pnl,
        trades: row.trades,
      })),
    [perfBySymbol]
  );

  const pieWinLossData = useMemo(
    () => [
      { name: "Wins", value: summary.wins },
      { name: "Losses", value: summary.losses },
      {
        name: "Neutros",
        value: Math.max(summary.total - summary.wins - summary.losses, 0),
      },
    ],
    [summary]
  );

  const PIE_COLORS = ["#4caf50", "#f44336", "#757575"];

  // Heatmap EA × timeframe
  const heatmapEA_TF = useMemo(() => {
    const cellMap = new Map<
      string,
      { ea: string; timeframe: string; trades: number; wins: number; winRate: number }
    >();
    const eaSet = new Set<string>();
    const tfSet = new Set<string>();

    visibleTrades.forEach((t) => {
      if (!t.ea || !t.timeframe) return;
      const ea = t.ea.trim();
      const timeframe = t.timeframe.trim();
      const key = `${ea}__${timeframe}`;
      if (!cellMap.has(key)) {
        cellMap.set(key, { ea, timeframe, trades: 0, wins: 0, winRate: 0 });
      }
      const cell = cellMap.get(key)!;
      cell.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      if (v > 0) cell.wins += 1;

      eaSet.add(ea);
      tfSet.add(timeframe);
    });

    cellMap.forEach((cell) => {
      cell.winRate = cell.trades > 0 ? (cell.wins / cell.trades) * 100 : 0;
    });

    const eas = Array.from(eaSet).sort();
    const timeframes = Array.from(tfSet).sort();

    return { cellMap, eas, timeframes };
  }, [visibleTrades]);

  // Confluencias avanzadas
  const confEA_Symbol_TF_Patron = useMemo<ConfluenceRow[]>(() => {
    const map = new Map<
      string,
      {
        ea: string;
        symbol: string;
        timeframe: string;
        extra: string;
        trades: number;
        wins: number;
        losses: number;
        pnl: number;
      }
    >();

    visibleTrades.forEach((t) => {
      if (!t.patron) return;
      const ea = (t.ea || "SIN_EA").trim() || "SIN_EA";
      const symbol = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      const tf = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      const extra = t.patron.trim();
      const key = `${ea}__${symbol}__${tf}__${extra}`;
      if (!map.has(key)) {
        map.set(key, { ea, symbol, timeframe: tf, extra, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: ConfluenceRow[] = [];
    map.forEach((v) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        ea: v.ea,
        symbol: v.symbol,
        timeframe: v.timeframe,
        extra: v.extra,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  const confEA_Symbol_TF_Vela = useMemo<ConfluenceRow[]>(() => {
    const map = new Map<
      string,
      {
        ea: string;
        symbol: string;
        timeframe: string;
        extra: string;
        trades: number;
        wins: number;
        losses: number;
        pnl: number;
      }
    >();

    visibleTrades.forEach((t) => {
      if (!t.vela) return;
      const ea = (t.ea || "SIN_EA").trim() || "SIN_EA";
      const symbol = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      const tf = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      const extra = t.vela.trim();
      const key = `${ea}__${symbol}__${tf}__${extra}`;
      if (!map.has(key)) {
        map.set(key, { ea, symbol, timeframe: tf, extra, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: ConfluenceRow[] = [];
    map.forEach((v) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        ea: v.ea,
        symbol: v.symbol,
        timeframe: v.timeframe,
        extra: v.extra,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  const confEA_Symbol_TF_Emocion = useMemo<ConfluenceRow[]>(() => {
    const map = new Map<
      string,
      {
        ea: string;
        symbol: string;
        timeframe: string;
        extra: string;
        trades: number;
        wins: number;
        losses: number;
        pnl: number;
      }
    >();

    visibleTrades.forEach((t) => {
      if (!t.emocion) return;
      const ea = (t.ea || "SIN_EA").trim() || "SIN_EA";
      const symbol = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      const tf = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      const extra = t.emocion.trim();
      const key = `${ea}__${symbol}__${tf}__${extra}`;
      if (!map.has(key)) {
        map.set(key, { ea, symbol, timeframe: tf, extra, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: ConfluenceRow[] = [];
    map.forEach((v) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        ea: v.ea,
        symbol: v.symbol,
        timeframe: v.timeframe,
        extra: v.extra,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  const confEA_Symbol_TF_Session = useMemo<ConfluenceRow[]>(() => {
    const map = new Map<
      string,
      {
        ea: string;
        symbol: string;
        timeframe: string;
        extra: string;
        trades: number;
        wins: number;
        losses: number;
        pnl: number;
      }
    >();

    visibleTrades.forEach((t) => {
      if (!t.session) return;
      const ea = (t.ea || "SIN_EA").trim() || "SIN_EA";
      const symbol = (t.symbol || "SIN_SYMBOL").trim() || "SIN_SYMBOL";
      const tf = (t.timeframe || "SIN_TF").trim() || "SIN_TF";
      const extra = t.session.trim();
      const key = `${ea}__${symbol}__${tf}__${extra}`;
      if (!map.has(key)) {
        map.set(key, { ea, symbol, timeframe: tf, extra, trades: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const rec = map.get(key)!;
      rec.trades += 1;
      const v = safeNumber(t.pnl_usd_gross);
      rec.pnl += v;
      if (v > 0) rec.wins += 1;
      else if (v < 0) rec.losses += 1;
    });

    const rows: ConfluenceRow[] = [];
    map.forEach((v) => {
      const winRate = v.trades > 0 ? (v.wins / v.trades) * 100 : 0;
      rows.push({
        ea: v.ea,
        symbol: v.symbol,
        timeframe: v.timeframe,
        extra: v.extra,
        trades: v.trades,
        wins: v.wins,
        losses: v.losses,
        winRate,
        pnl: v.pnl,
      });
    });

    rows.sort((a, b) => b.trades - a.trades);
    return rows;
  }, [visibleTrades]);

  // Filtro de confluencias (sobre visibleTrades)
  const confFilteredTrades = useMemo(() => {
    if (!confFiltersApplied) return [];

    let list = visibleTrades.slice();

    if (confEa) {
      list = list.filter((t) => (t.ea || "").toUpperCase() === confEa.toUpperCase());
    }
    if (confSymbol) {
      list = list.filter(
        (t) => (t.symbol || "").toUpperCase() === confSymbol.toUpperCase()
      );
    }
    if (confTf) {
      list = list.filter(
        (t) => (t.timeframe || "").toUpperCase() === confTf.toUpperCase()
      );
    }
    if (confSession) {
      list = list.filter(
        (t) => (t.session || "").toUpperCase() === confSession.toUpperCase()
      );
    }
    if (confEmocion) {
      list = list.filter(
        (t) => (t.emocion || "").toUpperCase() === confEmocion.toUpperCase()
      );
    }
    if (confPatron) {
      list = list.filter(
        (t) => (t.patron || "").toUpperCase() === confPatron.toUpperCase()
      );
    }
    if (confVela) {
      list = list.filter((t) => (t.vela || "").toUpperCase() === confVela.toUpperCase());
    }

    return list;
  }, [
    visibleTrades,
    confEa,
    confSymbol,
    confTf,
    confSession,
    confEmocion,
    confPatron,
    confVela,
    confFiltersApplied,
  ]);

  const confSummary = useMemo(() => {
    const total = confFilteredTrades.length;
    if (total === 0) {
      return { total, wins: 0, losses: 0, winRate: 0, pnl: 0 };
    }
    let wins = 0;
    let losses = 0;
    let pnl = 0;
    confFilteredTrades.forEach((t) => {
      const v = safeNumber(t.pnl_usd_gross);
      pnl += v;
      if (v > 0) wins++;
      else if (v < 0) losses++;
    });
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { total, wins, losses, winRate, pnl };
  }, [confFilteredTrades]);

  const applyConfluenceFilters = () => {
    setConfFiltersApplied(true);
  };

  const clearConfluenceFilters = () => {
    setConfEa("");
    setConfSymbol("");
    setConfTf("");
    setConfSession("");
    setConfEmocion("");
    setConfPatron("");
    setConfVela("");
    setConfFiltersApplied(false);
  };

  // Winrate por EA (para bloque pequeño)
  const winrateByEAOnly = useMemo(
    () =>
      perfByEA.map((row) => ({
        ea: row.key,
        winRate: row.winRate,
        trades: row.trades,
      })),
    [perfByEA]
  );

  // PnL por símbolo (para bloque pequeño)
  const pnlBySymbolOnly = useMemo(
    () =>
      perfBySymbol.map((row) => ({
        symbol: row.key,
        pnl: row.pnl,
        trades: row.trades,
      })),
    [perfBySymbol]
  );

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <TopNav />

      {/* Header Estadísticas & Confluencias */}
      <div style={CARD_STYLE}>
        <h1 className="title" style={{ marginTop: 0, marginBottom: 8 }}>
          Estadísticas &amp; Confluencias
        </h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 13, marginBottom: 8 }}>
          Lectura 100% en frontend. No se modifica la BD — solo analizamos tus trades.
        </p>

        {/* Menú de acciones: Aplicar | Limpiar | Exportar + presets rápidos */}
        <div
          style={{
            fontSize: 13,
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "nowrap",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={handleApplyGlobalFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleClearGlobalFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleExportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Exportar CSV filtrados
          </button>

          {/* Presets rápidos */}
          <button
            type="button"
            className="btn"
            onClick={() => applyQuickPreset("today")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
              marginLeft: 8,
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => applyQuickPreset("7d")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => applyQuickPreset("30d")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => applyQuickPreset("ny")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Solo NY Session
          </button>
        </div>

        {/* Winrate global destacado */}
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              ...BADGE_STYLE_BASE,
              backgroundColor: summary.winRate >= 60 ? "#1b5e20" : "#37474f",
              color: "#fff",
            }}
          >
            Winrate global: {fmtPct(summary.winRate)}
          </span>
        </div>
      </div>

      {/* Filtros globales */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Filtros globales</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 12,
          }}
        >
          <div className="field">
            <div className="label">Desde (fecha)</div>
            <input
              className="input"
              type="date"
              value={filterDateFromDraft}
              onChange={(e) => setFilterDateFromDraft(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="label">Hasta (fecha)</div>
            <input
              className="input"
              type="date"
              value={filterDateToDraft}
              onChange={(e) => setFilterDateToDraft(e.target.value)}
            />
          </div>
          <div className="field">
            <div className="label">EA</div>
            <select
              className="input"
              value={filterEaDraft}
              onChange={(e) => setFilterEaDraft(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allEAs.map((ea) => (
                <option key={ea} value={ea}>
                  {ea}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Símbolo</div>
            <select
              className="input"
              value={filterSymbolDraft}
              onChange={(e) => setFilterSymbolDraft(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allSymbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Timeframe</div>
            <select
              className="input"
              value={filterTfDraft}
              onChange={(e) => setFilterTfDraft(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allTimeframes.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Lado</div>
            <select
              className="input"
              value={filterSideDraft}
              onChange={(e) => setFilterSideDraft(e.target.value)}
            >
              <option value="">(Todos)</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div className="field">
            <div className="label">Sesión</div>
            <select
              className="input"
              value={filterSessionDraft}
              onChange={(e) => setFilterSessionDraft(e.target.value)}
            >
              <option value="">(Todas)</option>
              {allSessions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Presets favoritos */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "minmax(200px,2fr) minmax(200px,2fr)",
            gap: 12,
          }}
        >
          <div>
            <div className="label">Nombre de preset</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                className="input"
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Setup EMA-Wave M5"
              />
              <button
                type="button"
                className="btn"
                onClick={handleSavePreset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 0,
                  minWidth: 0,
                  width: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                Guardar preset
              </button>
            </div>
          </div>
          <div>
            <div className="label">Presets guardados</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                className="input"
                value={selectedPresetName}
                onChange={(e) => setSelectedPresetName(e.target.value)}
              >
                <option value="">(Ninguno)</option>
                {presets
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn"
                onClick={handleLoadPreset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 0,
                  minWidth: 0,
                  width: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                Cargar preset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen global + bloques pequeños */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>Resumen global</h2>
        {loading ? (
          <p>Cargando…</p>
        ) : error ? (
          <p style={{ color: "#f88" }}>{error}</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <div className="label">Trades (filtrados)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.total}</div>
              </div>
              <div>
                <div className="label">Wins</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#4caf50" }}>
                  {summary.wins}
                </div>
              </div>
              <div>
                <div className="label">Losses</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f44336" }}>
                  {summary.losses}
                </div>
              </div>
              <div>
                <div className="label">Win rate</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(summary.winRate)}</div>
              </div>
              <div>
                <div className="label">PnL total</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtMoney(summary.pnl)}</div>
              </div>
              <div>
                <div className="label">PnL promedio</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {fmtMoney(summary.avgPnL)}
                </div>
              </div>
            </div>

            {/* Top confluencias (sniper) + Winrate por EA + PnL por símbolo */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px,2.2fr) minmax(160px,1.4fr) minmax(160px,1.4fr)",
                gap: 16,
              }}
            >
              {/* Top confluencias modo sniper */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 14 }}>
                  Top confluencias (modo sniper)
                </h3>
                <table style={TABLE_STYLE}>
                  <thead>
                    <tr>
                      <th style={TH_STYLE}>EA</th>
                      <th style={TH_STYLE}>Símbolo</th>
                      <th style={TH_STYLE}>TF</th>
                      <th style={TH_STYLE}>Trades</th>
                      <th style={TH_STYLE}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSniperCombos.map((c, idx) => {
                      const rowStyle: React.CSSProperties = {
                        ...TD_STYLE_BASE,
                        backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                      };
                      return (
                        <tr key={`${c.ea}__${c.symbol}__${c.timeframe}`}>
                          <td style={rowStyle}>{c.ea}</td>
                          <td style={rowStyle}>{c.symbol}</td>
                          <td style={rowStyle}>{c.timeframe}</td>
                          <td style={rowStyle}>{c.trades}</td>
                          <td style={rowStyle}>{fmtPct(c.winRate)}</td>
                        </tr>
                      );
                    })}
                    {topSniperCombos.length === 0 && (
                      <tr>
                        <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={5}>
                          Aún no hay suficientes trades por combo (mínimo 5).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Winrate por EA */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 14 }}>Winrate por EA</h3>
                <table style={TABLE_STYLE}>
                  <thead>
                    <tr>
                      <th style={TH_STYLE}>EA</th>
                      <th style={TH_STYLE}>Trades</th>
                      <th style={TH_STYLE}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winrateByEAOnly.map((row, idx) => {
                      const rowStyle: React.CSSProperties = {
                        ...TD_STYLE_BASE,
                        backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                      };
                      return (
                        <tr key={row.ea}>
                          <td style={rowStyle}>{row.ea}</td>
                          <td style={rowStyle}>{row.trades}</td>
                          <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                        </tr>
                      );
                    })}
                    {winrateByEAOnly.length === 0 && (
                      <tr>
                        <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={3}>
                          Sin datos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* P&L por símbolo */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 14 }}>
                  P&amp;L por símbolo (USD)
                </h3>
                <table style={TABLE_STYLE}>
                  <thead>
                    <tr>
                      <th style={TH_STYLE}>Símbolo</th>
                      <th style={TH_STYLE}>Trades</th>
                      <th style={TH_STYLE}>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlBySymbolOnly.map((row, idx) => {
                      const rowStyle: React.CSSProperties = {
                        ...TD_STYLE_BASE,
                        backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                      };
                      return (
                        <tr key={row.symbol}>
                          <td style={rowStyle}>{row.symbol}</td>
                          <td style={rowStyle}>{row.trades}</td>
                          <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                        </tr>
                      );
                    })}
                    {pnlBySymbolOnly.length === 0 && (
                      <tr>
                        <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={3}>
                          Sin datos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Performance por EA / símbolo / timeframe (tablas grandes) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Performance por EA */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Performance por EA</h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {perfByEA.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={row.key}>
                    <td style={rowStyle}>{row.key}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {perfByEA.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={6}>
                    Sin datos en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Performance por símbolo */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Performance por símbolo</h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {perfBySymbol.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={row.key}>
                    <td style={rowStyle}>{row.key}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {perfBySymbol.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={6}>
                    Sin datos en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Performance por timeframe */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Performance por timeframe
          </h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {perfByTimeframe.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={row.key}>
                    <td style={rowStyle}>{row.key}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {perfByTimeframe.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={6}>
                    Sin datos en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficas: barras + pastel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 2fr) minmax(260px, 1.5fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Barras por símbolo */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Gráfica de barras — PnL por símbolo
          </h2>
          {chartDataSymbolPnL.length === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos para este filtro.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataSymbolPnL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="symbol" stroke="#ccc" />
                  <YAxis stroke="#ccc" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
                    formatter={(value: any, name: any) =>
                      name === "pnl" ? fmtMoney(Number(value)) : value
                    }
                  />
                  <Legend />
                  <Bar dataKey="pnl" name="PnL" fill="#2196f3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pastel wins vs losses */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Gráfica de pastel — Wins vs Losses
          </h2>
          {summary.total === 0 ? (
            <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos para este filtro.</p>
          ) : (
            <div style={{ width: "100%", height: 260, display: "flex", justifyContent: "center" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }}
                  />
                  <Legend />
                  <Pie
                    data={pieWinLossData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {pieWinLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap EA × Timeframe */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Heatmap — EA × Timeframe (Winrate)
        </h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Cada celda muestra el win rate y número de trades para esa combinación EA × TF,
          usando solo los trades del filtro global actual.
        </p>

        {heatmapEA_TF.eas.length === 0 || heatmapEA_TF.timeframes.length === 0 ? (
          <p style={{ fontSize: 12, opacity: 0.8 }}>Sin datos para este filtro.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>EA \ TF</th>
                  {heatmapEA_TF.timeframes.map((tf) => (
                    <th key={tf} style={TH_STYLE}>
                      {tf}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapEA_TF.eas.map((ea, rowIdx) => (
                  <tr key={ea}>
                    <td
                      style={{
                        ...TD_STYLE_BASE,
                        backgroundColor: rowIdx % 2 === 0 ? "#151515" : "#101010",
                        fontWeight: 600,
                      }}
                    >
                      {ea}
                    </td>
                    {heatmapEA_TF.timeframes.map((tf) => {
                      const key = `${ea}__${tf}`;
                      const cell = heatmapEA_TF.cellMap.get(key);
                      const tradesCount = cell?.trades ?? 0;
                      const winRate = cell?.winRate ?? 0;
                      const bg = getHeatCellColor(winRate, tradesCount);
                      return (
                        <td
                          key={tf}
                          style={{
                            ...TD_STYLE_BASE,
                            textAlign: "center",
                            backgroundColor: bg,
                            color: "#fff",
                            fontSize: 12,
                          }}
                          title={
                            tradesCount > 0
                              ? `Win rate: ${fmtPct(winRate)} | Trades: ${tradesCount}`
                              : "Sin trades"
                          }
                        >
                          {tradesCount === 0 ? "—" : `${fmtPct(winRate)} (${tradesCount})`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tiempo & motivos de cierre */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Tiempo & motivos de cierre
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px,0.8fr) minmax(260px,1.6fr)",
            gap: 16,
          }}
        >
          {/* Duración promedio */}
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 14 }}>
              Duración promedio de los trades (cerrados)
            </h3>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {formatDurationHMS(avgDurationMs)}
            </div>
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
              Calculado solo con trades que tienen fecha de apertura y cierre válidas en este
              filtro global.
            </p>
          </div>

          {/* Desglose por close_reason */}
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 14 }}>
              Desglose por motivo de cierre
            </h3>
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Motivo</th>
                  <th style={TH_STYLE}>Trades</th>
                  <th style={TH_STYLE}>Wins</th>
                  <th style={TH_STYLE}>Losses</th>
                  <th style={TH_STYLE}>Win%</th>
                  <th style={TH_STYLE}>PnL</th>
                </tr>
              </thead>
              <tbody>
                {perfByCloseReason.map((row, idx) => {
                  const rowStyle: React.CSSProperties = {
                    ...TD_STYLE_BASE,
                    backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                  };
                  const label =
                    row.reason === "TP"
                      ? "TP"
                      : row.reason === "SL"
                      ? "SL"
                      : row.reason === "MANUAL"
                      ? "MANUAL"
                      : row.reason;
                  return (
                    <tr key={row.reason}>
                      <td style={rowStyle}>{label}</td>
                      <td style={rowStyle}>{row.trades}</td>
                      <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                      <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                      <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                      <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                    </tr>
                  );
                })}
                {perfByCloseReason.length === 0 && (
                  <tr>
                    <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={6}>
                      Sin datos de cierre en este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance por día de la semana */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Performance por día de la semana
        </h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Te muestra en qué días sueles ganar o perder más, usando la fecha de apertura de cada
          trade bajo el filtro global actual.
        </p>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Día</th>
              <th style={TH_STYLE}>Trades</th>
              <th style={TH_STYLE}>Wins</th>
              <th style={TH_STYLE}>Losses</th>
              <th style={TH_STYLE}>Win%</th>
              <th style={TH_STYLE}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {perfByDayOfWeek.map((row, idx) => {
              const rowStyle: React.CSSProperties = {
                ...TD_STYLE_BASE,
                backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
              };
              return (
                <tr key={row.label}>
                  <td style={rowStyle}>{row.label}</td>
                  <td style={rowStyle}>{row.trades}</td>
                  <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                  <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                  <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                  <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Performance por hora del día */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Performance por hora del día (Mazatlán)
        </h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Útil para ver si eres más fuerte en la mañana (ej. 7–9 AM) o en otros horarios, según
          la hora de apertura de cada trade.
        </p>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Hora</th>
              <th style={TH_STYLE}>Trades</th>
              <th style={TH_STYLE}>Wins</th>
              <th style={TH_STYLE}>Losses</th>
              <th style={TH_STYLE}>Win%</th>
              <th style={TH_STYLE}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {perfByHourOfDay.map((row, idx) => {
              const rowStyle: React.CSSProperties = {
                ...TD_STYLE_BASE,
                backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
              };
              return (
                <tr key={row.hour}>
                  <td style={rowStyle}>{row.label}</td>
                  <td style={rowStyle}>{row.trades}</td>
                  <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                  <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                  <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                  <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confluencias: EA + símbolo + timeframe */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Confluencias: EA + símbolo + timeframe
        </h2>
        <table style={TABLE_STYLE}>
          <thead>
            <tr>
              <th style={TH_STYLE}>EA</th>
              <th style={TH_STYLE}>Símbolo</th>
              <th style={TH_STYLE}>TF</th>
              <th style={TH_STYLE}>Trades</th>
              <th style={TH_STYLE}>Wins</th>
              <th style={TH_STYLE}>Losses</th>
              <th style={TH_STYLE}>Win%</th>
              <th style={TH_STYLE}>PnL</th>
            </tr>
          </thead>
          <tbody>
            {combosEA_Symbol_TF.map((row, idx) => {
              const rowStyle: React.CSSProperties = {
                ...TD_STYLE_BASE,
                backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
              };
              return (
                <tr key={`${row.ea}__${row.symbol}__${row.timeframe}`}>
                  <td style={rowStyle}>{row.ea}</td>
                  <td style={rowStyle}>{row.symbol}</td>
                  <td style={rowStyle}>{row.timeframe}</td>
                  <td style={rowStyle}>{row.trades}</td>
                  <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                  <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                  <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                  <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                </tr>
              );
            })}
            {combosEA_Symbol_TF.length === 0 && (
              <tr>
                <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={8}>
                  Sin combinaciones en este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bloques de confluencias avanzadas (UNO ABAJO DEL OTRO, FULL WIDTH) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* EA + símbolo + TF + patrón */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Confluencias avanzadas: EA + símbolo + TF + patrón
          </h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>Patrón</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {confEA_Symbol_TF_Patron.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={`${row.ea}__${row.symbol}__${row.timeframe}__${row.extra}`}>
                    <td style={rowStyle}>{row.ea}</td>
                    <td style={rowStyle}>{row.symbol}</td>
                    <td style={rowStyle}>{row.timeframe}</td>
                    <td style={rowStyle}>{row.extra}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {confEA_Symbol_TF_Patron.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={9}>
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* EA + símbolo + TF + vela */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Confluencias avanzadas: EA + símbolo + TF + vela
          </h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>Vela</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {confEA_Symbol_TF_Vela.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={`${row.ea}__${row.symbol}__${row.timeframe}__${row.extra}`}>
                    <td style={rowStyle}>{row.ea}</td>
                    <td style={rowStyle}>{row.symbol}</td>
                    <td style={rowStyle}>{row.timeframe}</td>
                    <td style={rowStyle}>{row.extra}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {confEA_Symbol_TF_Vela.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={9}>
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* EA + símbolo + TF + emoción */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Confluencias avanzadas: EA + símbolo + TF + emoción
          </h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>Emoción</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {confEA_Symbol_TF_Emocion.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={`${row.ea}__${row.symbol}__${row.timeframe}__${row.extra}`}>
                    <td style={rowStyle}>{row.ea}</td>
                    <td style={rowStyle}>{row.symbol}</td>
                    <td style={rowStyle}>{row.timeframe}</td>
                    <td style={rowStyle}>{row.extra}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {confEA_Symbol_TF_Emocion.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={9}>
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* EA + símbolo + TF + sesión */}
        <div style={CARD_STYLE}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
            Confluencias avanzadas: EA + símbolo + TF + sesión
          </h2>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>Sesión</th>
                <th style={TH_STYLE}>Trades</th>
                <th style={TH_STYLE}>Wins</th>
                <th style={TH_STYLE}>Losses</th>
                <th style={TH_STYLE}>Win%</th>
                <th style={TH_STYLE}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {confEA_Symbol_TF_Session.map((row, idx) => {
                const rowStyle: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: idx % 2 === 0 ? "#151515" : "#101010",
                };
                return (
                  <tr key={`${row.ea}__${row.symbol}__${row.timeframe}__${row.extra}`}>
                    <td style={rowStyle}>{row.ea}</td>
                    <td style={rowStyle}>{row.symbol}</td>
                    <td style={rowStyle}>{row.timeframe}</td>
                    <td style={rowStyle}>{row.extra}</td>
                    <td style={rowStyle}>{row.trades}</td>
                    <td style={{ ...rowStyle, color: "#4caf50" }}>{row.wins}</td>
                    <td style={{ ...rowStyle, color: "#f44336" }}>{row.losses}</td>
                    <td style={rowStyle}>{fmtPct(row.winRate)}</td>
                    <td style={rowStyle}>{fmtMoney(row.pnl)}</td>
                  </tr>
                );
              })}
              {confEA_Symbol_TF_Session.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={9}>
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filtro de confluencias avanzado + detalle de trades filtrados */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Filtro de confluencias avanzado
        </h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Primero se aplican los filtros globales. Luego aquí eliges la combinación específica
          (EA, símbolo, TF, sesión, emoción, patrón, vela) y se muestra el detalle de trades.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div className="field">
            <div className="label">EA</div>
            <select
              className="input"
              value={confEa}
              onChange={(e) => setConfEa(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allEAs.map((ea) => (
                <option key={ea} value={ea}>
                  {ea}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Símbolo</div>
            <select
              className="input"
              value={confSymbol}
              onChange={(e) => setConfSymbol(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allSymbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Timeframe</div>
            <select
              className="input"
              value={confTf}
              onChange={(e) => setConfTf(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allTimeframes.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Sesión</div>
            <select
              className="input"
              value={confSession}
              onChange={(e) => setConfSession(e.target.value)}
            >
              <option value="">(Todas)</option>
              {allSessions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Emoción</div>
            <select
              className="input"
              value={confEmocion}
              onChange={(e) => setConfEmocion(e.target.value)}
            >
              <option value="">(Todas)</option>
              {allEmociones.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Patrón</div>
            <select
              className="input"
              value={confPatron}
              onChange={(e) => setConfPatron(e.target.value)}
            >
              <option value="">(Todos)</option>
              {allPatrones.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="label">Vela</div>
            <select
              className="input"
              value={confVela}
              onChange={(e) => setConfVela(e.target.value)}
            >
              <option value="">(Todas)</option>
              {allVelas.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones de confluencia en un solo renglón, más pequeños, esquinas cuadradas */}
        <div
          className="btn-row"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "nowrap",
            marginBottom: 8,
          }}
        >
          <button
            className="btn"
            type="button"
            onClick={applyConfluenceFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "3px 8px",
              fontSize: 11,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Aplicar filtros de confluencia
          </button>
          <button
            className="btn"
            type="button"
            onClick={clearConfluenceFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "3px 8px",
              fontSize: 11,
              borderRadius: 0,
              minWidth: 0,
              width: "auto",
            }}
          >
            Limpiar filtros de confluencia
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div className="label">Trades</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{confSummary.total}</div>
          </div>
          <div>
            <div className="label">Wins</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#4caf50" }}>
              {confSummary.wins}
            </div>
          </div>
          <div>
            <div className="label">Losses</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f44336" }}>
              {confSummary.losses}
            </div>
          </div>
          <div>
            <div className="label">Win rate</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {fmtPct(confSummary.winRate)}
            </div>
          </div>
          <div>
            <div className="label">PnL</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {fmtMoney(confSummary.pnl)}
            </div>
          </div>
        </div>

        {/* Detalle de trades (filtrados) */}
        <div
          style={{
            maxHeight: 320,
            overflow: "auto",
            borderRadius: 8,
            border: "1px solid #222",
          }}
        >
          <h3
            style={{
              margin: 0,
              padding: "6px 8px",
              fontSize: 14,
              borderBottom: "1px solid #333",
              backgroundColor: "#000",
            }}
          >
            Detalle de trades (filtrados)
          </h3>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>ID</th>
                <th style={TH_STYLE}>Ticket</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Sesión</th>
                <th style={TH_STYLE}>Emoción</th>
                <th style={TH_STYLE}>Patrón</th>
                <th style={TH_STYLE}>Vela</th>
                <th style={TH_STYLE}>Open</th>
                <th style={TH_STYLE}>Close</th>
                <th style={TH_STYLE}>PnL</th>
                <th style={TH_STYLE}>Cierre</th>
                <th style={TH_STYLE}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {confFilteredTrades.map((t, idx) => {
                const isWin = safeNumber(t.pnl_usd_gross) > 0;
                const isLoss = safeNumber(t.pnl_usd_gross) < 0;
                const rowBg = idx % 2 === 0 ? "#151515" : "#101010";
                const tdBase: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: rowBg,
                };
                return (
                  <tr key={t.id}>
                    <td style={tdBase}>{t.id}</td>
                    <td style={tdBase}>{t.ticket || "—"}</td>
                    <td style={tdBase}>{t.symbol || "—"}</td>
                    <td style={tdBase}>{t.timeframe || "—"}</td>
                    <td style={tdBase}>{t.ea || "—"}</td>
                    <td style={tdBase}>{t.session || "—"}</td>
                    <td style={tdBase}>{t.emocion || "—"}</td>
                    <td style={tdBase}>{t.patron || "—"}</td>
                    <td style={tdBase}>{t.vela || "—"}</td>
                    <td style={tdBase}>{fmtDateShort(t.dt_open_utc)}</td>
                    <td style={tdBase}>{fmtDateShort(t.dt_close_utc)}</td>
                    <td
                      style={{
                        ...tdBase,
                        color: isWin ? "#4caf50" : isLoss ? "#f44336" : "#ccc",
                      }}
                    >
                      {fmtMoney(safeNumber(t.pnl_usd_gross))}
                    </td>
                    <td style={tdBase}>
                      <span
                        style={{
                          ...BADGE_STYLE_BASE,
                          backgroundColor:
                            (t.close_reason || "").toUpperCase() === "TP"
                              ? "#1b5e20"
                              : (t.close_reason || "").toUpperCase() === "SL"
                              ? "#b71c1c"
                              : "#424242",
                          color: "#fff",
                        }}
                      >
                        {(t.close_reason || "—").toUpperCase()}
                      </span>
                    </td>
                    <td style={tdBase}>
                      <a
                        href={`/trades/${t.id}`}
                        className="btn link"
                        style={{ fontSize: 11, padding: "3px 6px" }}
                      >
                        Ver
                      </a>
                    </td>
                  </tr>
                );
              })}
              {confFilteredTrades.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={14}>
                    No hay trades para esta combinación (o aún no aplicas filtros).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Muestra de trades filtrados globales */}
      <div style={CARD_STYLE}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>
          Detalle de trades (filtro global)
        </h2>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Aquí ves los trades resultantes de los filtros globales. Útil para revisar rápidamente
          qué está alimentando los bloques de arriba.
        </p>
        <div
          style={{
            maxHeight: 320,
            overflow: "auto",
            borderRadius: 8,
            border: "1px solid #222",
          }}
        >
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                <th style={TH_STYLE}>ID</th>
                <th style={TH_STYLE}>Ticket</th>
                <th style={TH_STYLE}>Símbolo</th>
                <th style={TH_STYLE}>TF</th>
                <th style={TH_STYLE}>EA</th>
                <th style={TH_STYLE}>Sesión</th>
                <th style={TH_STYLE}>Open</th>
                <th style={TH_STYLE}>Close</th>
                <th style={TH_STYLE}>PnL</th>
                <th style={TH_STYLE}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((t, idx) => {
                const isWin = safeNumber(t.pnl_usd_gross) > 0;
                const isLoss = safeNumber(t.pnl_usd_gross) < 0;
                const rowBg = idx % 2 === 0 ? "#151515" : "#101010";
                const tdBase: React.CSSProperties = {
                  ...TD_STYLE_BASE,
                  backgroundColor: rowBg,
                };
                return (
                  <tr key={t.id}>
                    <td style={tdBase}>{t.id}</td>
                    <td style={tdBase}>{t.ticket || "—"}</td>
                    <td style={tdBase}>{t.symbol || "—"}</td>
                    <td style={tdBase}>{t.timeframe || "—"}</td>
                    <td style={tdBase}>{t.ea || "—"}</td>
                    <td style={tdBase}>{t.session || "—"}</td>
                    <td style={tdBase}>{fmtDateShort(t.dt_open_utc)}</td>
                    <td style={tdBase}>{fmtDateShort(t.dt_close_utc)}</td>
                    <td
                      style={{
                        ...tdBase,
                        color: isWin ? "#4caf50" : isLoss ? "#f44336" : "#ccc",
                      }}
                    >
                      {fmtMoney(safeNumber(t.pnl_usd_gross))}
                    </td>
                    <td style={tdBase}>
                      <a
                        href={`/trades/${t.id}`}
                        className="btn link"
                        style={{ fontSize: 11, padding: "3px 6px" }}
                      >
                        Ver
                      </a>
                    </td>
                  </tr>
                );
              })}
              {visibleTrades.length === 0 && (
                <tr>
                  <td style={{ ...TD_STYLE_BASE, paddingTop: 10 }} colSpan={10}>
                    Sin trades en este filtro global.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

