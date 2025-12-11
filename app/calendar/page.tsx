// ===================== [CAL-0] /calendar/page.tsx =====================
// Vista de calendario anual Bitlog
// - 12 meses en grid (P&L diario verde/rojo)
// - Calendario grande del mes seleccionado
// - Nuevo: tercer bloque con tabla de trades del día seleccionado
// ======================================================================

"use client";

import * as React from "react";
import TopNav from "@/components/TopNav";
import { createClient } from "@supabase/supabase-js";

// --------------------- [CAL-1] Tipos básicos ---------------------------
// [CAL-1.1] Trade con campos extendidos (alineado con /trades/page.tsx)
type Trade = {
  id: number;
  ticket: string;
  symbol: string | null;
  side: "BUY" | "SELL" | null;
  volume: number | null;
  entry_price: number | null;
  exit_price: number | null;
  dt_open_utc: string | null;
  dt_close_utc: string | null;
  ea: string | null;
  session: string | null;
  pnl_usd_gross: number | null;
};

type DaySummary = {
  key: string; // "YYYY-MM-DD"
  pnl: number; // suma del día
  count: number; // número de trades
};

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

// [CAL-1.2] Formateador de fechas SOLO para clave de día local (America/Mazatlan)
const fmtDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mazatlan",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// [CAL-1.3] USD corto para celdas
const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

// [CAL-1.4] Fecha legible para detalle (igual filosofía que /trades)
const fmtDT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mazatlan",
});

const asDT = (s: string | null) => (s ? fmtDT.format(new Date(s)) : "");

// [CAL-1.5] Helper CSS
const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");

// [CAL-1.6] Convierte un dt_open_utc en clave "YYYY-MM-DD" en horario Mazatlán
function dayKeyFromUtc(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return fmtDateKey.format(d); // e.g. 2025-01-03
}

// [CAL-1.7] Genera matriz de semanas para un mes (L a D, lunes como primer día)
function buildMonthMatrix(year: number, monthIdx0: number): (number | null)[][] {
  // monthIdx0: 0=Ene, 11=Dic
  const first = new Date(Date.UTC(year, monthIdx0, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();

  // getUTCDay: 0=Domingo ... 6=Sábado
  // Queremos 0=Lunes ... 6=Domingo
  const firstWeekday = (first.getUTCDay() + 6) % 7;

  const weeks: (number | null)[][] = [];
  let current = 1 - firstWeekday;

  while (current <= daysInMonth) {
    const row: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      if (current < 1 || current > daysInMonth) row.push(null);
      else row.push(current);
      current++;
    }
    weeks.push(row);
  }
  return weeks;
}

// --------------------- [CAL-2] Componente principal --------------------
export default function CalendarPage() {
  // [CAL-2.1] Supabase local
  const [sb] = React.useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  // [CAL-2.2] Año y mes seleccionados
  const now = new Date();
  const initialYear = now.getFullYear();
  const initialMonth = now.getMonth(); // 0-11

  const [year, setYear] = React.useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] =
    React.useState<number>(initialMonth);

  // [CAL-2.3] Datos crudos y estados de carga
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  // [CAL-2.4] Día seleccionado en el calendario grande (YYYY-MM-DD)
  const [selectedDayKey, setSelectedDayKey] = React.useState<string | null>(
    null
  );

  // [CAL-2.5] Carga inicial + cuando cambia el año
  React.useEffect(() => {
    let cancelled = false;

    async function loadYear(y: number) {
      setLoading(true);
      setErr(null);
      try {
        // 1) Validar sesión (igual que en /trades)
        const ses = await sb.auth.getSession();
        const me = ses.data.session?.user ?? null;
        if (!me) {
          if (!cancelled) {
            setErr("No hay sesión. Entra a /login");
            setTrades([]);
          }
          return;
        }

        // 2) Rango [año-01-01, año+1-01-01) en UTC
        const from = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
        const to = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));

        const { data, error } = await sb
          .from("trades")
          .select(
            // [CAL-2.5.1] Seleccionamos todos los campos necesarios para el detalle
            "id,ticket,symbol,side,volume,entry_price,exit_price,dt_open_utc,dt_close_utc,ea,session,pnl_usd_gross"
          )
          .gte("dt_open_utc", from.toISOString())
          .lt("dt_open_utc", to.toISOString())
          .order("dt_open_utc", { ascending: true })
          .order("id", { ascending: true });

        if (error) {
          console.error("calendar loadYear error", error);
          if (!cancelled) {
            setErr(error.message);
            setTrades([]);
          }
          return;
        }

        if (!cancelled) {
          setTrades((data ?? []) as Trade[]);
          // al cambiar de año, limpiamos selección de día
          setSelectedDayKey(null);
        }
      } catch (e: any) {
        console.error("calendar loadYear exception", e);
        if (!cancelled) {
          setErr(String(e));
          setTrades([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadYear(year);

    return () => {
      cancelled = true;
    };
  }, [sb, year]);

  // [CAL-2.6] Mapas derivados: resumen por día
  const dayMap = React.useMemo(() => {
    const map: Record<string, DaySummary> = {};
    for (const t of trades) {
      const key = dayKeyFromUtc(t.dt_open_utc);
      if (!key) continue;
      const pnl = t.pnl_usd_gross ?? 0;
      if (!map[key]) {
        map[key] = { key, pnl: 0, count: 0 };
      }
      map[key].pnl += pnl;
      map[key].count += 1;
    }
    return map;
  }, [trades]);

  // [CAL-2.7] Derivados específicos del mes seleccionado
  const monthPrefix = React.useMemo(
    () => `${year}-${String(selectedMonth + 1).padStart(2, "0")}-`,
    [year, selectedMonth]
  );

  // [CAL-2.8.a] Trades del mes agrupados por día
  const tradesByDay = React.useMemo(() => {
    const res: Record<string, Trade[]> = {};
    for (const t of trades) {
      const key = dayKeyFromUtc(t.dt_open_utc);
      if (!key || !key.startsWith(monthPrefix)) continue;
      if (!res[key]) res[key] = [];
      res[key].push(t);
    }
    return res;
  }, [trades, monthPrefix]);

  // [CAL-2.8.b] Total P&L del mes (suma de dayMap)
  const monthTotal = React.useMemo(() => {
    let total = 0;
    for (const [key, s] of Object.entries(dayMap)) {
      if (key.startsWith(monthPrefix)) {
        total += s.pnl;
      }
    }
    return total;
  }, [dayMap, monthPrefix]);

  // [CAL-2.8.c] Trades del día seleccionado (para el tercer bloque)
  const selectedTrades = React.useMemo(
    () => (selectedDayKey ? tradesByDay[selectedDayKey] ?? [] : []),
    [selectedDayKey, tradesByDay]
  );

  const monthName = MONTH_NAMES[selectedMonth];

  // --------------------- [CAL-3] Handlers -------------------------------
  // [CAL-3.1] Selección de mes desde la cuadricula de 12 meses
  function handleSelectMonth(monthIdx0: number) {
    setSelectedMonth(monthIdx0);
    // limpiar selección de día cuando cambias de mes
    setSelectedDayKey(null);
  }

  // [CAL-3.2] Selección de día desde el calendario grande
  function handleSelectDay(key: string) {
    const list = tradesByDay[key] ?? [];
    if (!list.length) {
      // si no hay trades ese día, limpiamos selección
      setSelectedDayKey(null);
      return;
    }
    setSelectedDayKey(key);
  }

  // --------------------- [CAL-4] Render helpers -------------------------
  // [CAL-4.1] Mini calendario (cuadrícula de 12 meses)
  function renderMonthMini(monthIdx0: number) {
    const matrix = buildMonthMatrix(year, monthIdx0);
    const active = monthIdx0 === selectedMonth;

    return (
      <button
        key={monthIdx0}
        type="button"
        className={cls(
          "calendar-month-mini",
          active && "calendar-month-mini-active"
        )}
        onClick={() => handleSelectMonth(monthIdx0)}
      >
        {/* Nombre del mes */}
        <div className="calendar-month-name">
          {MONTH_NAMES[monthIdx0]}
        </div>

        {/* Encabezado L M M J V S D */}
        <div className="calendar-week-header">
          {WEEK_LABELS.map((w) => (
            <div key={w} className="calendar-week-cell">
              {w}
            </div>
          ))}
        </div>

        {/* Celdas de días */}
        <div className="calendar-weeks">
          {matrix.map((week, i) => (
            <div key={i} className="calendar-week-row">
              {week.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={idx}
                      className={cls(
                        "calendar-day-cell",
                        "calendar-day-empty"
                      )}
                    />
                  );
                }
                const key = `${year}-${String(monthIdx0 + 1).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const summary = dayMap[key];
                const has = !!summary;
                const pos = has && summary.pnl > 0;
                const neg = has && summary.pnl < 0;

                return (
                  <div
                    key={idx}
                    className={cls(
                      "calendar-day-cell",
                      "calendar-day-mini",
                      has && "calendar-day-has-trades",
                      pos && "calendar-day-pos",
                      neg && "calendar-day-neg"
                    )}
                  >
                    <div className="calendar-day-number-mini">
                      {day}
                    </div>
                    {summary && (
                      <div className="calendar-day-info-mini">
                        <div className="calendar-day-pnl-mini">
                          {fmtUSD.format(summary.pnl)}
                        </div>
                        <div className="calendar-day-count-mini">
                          {summary.count}{" "}
                          {summary.count === 1 ? "trade" : "trades"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </button>
    );
  }

  // [CAL-4.2] Calendario grande del mes seleccionado
  function renderMonthBig() {
    const matrix = buildMonthMatrix(year, selectedMonth);

    return (
      <div className="calendar-month-big">
        <div className="calendar-month-detail-title">
          {monthName} {year}
        </div>

        {/* Encabezado L M M J V S D */}
        <div className="calendar-week-header calendar-week-header-big">
          {WEEK_LABELS.map((w) => (
            <div key={w} className="calendar-week-cell">
              {w}
            </div>
          ))}
        </div>

        {/* Celdas detalladas */}
        <div className="calendar-weeks calendar-weeks-big">
          {matrix.map((week, i) => (
            <div
              key={i}
              className="calendar-week-row calendar-week-row-big"
            >
              {week.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={idx}
                      className={cls(
                        "calendar-day-cell",
                        "calendar-day-empty"
                      )}
                    />
                  );
                }
                const key = `${year}-${String(selectedMonth + 1).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const summary = dayMap[key];
                const trades = tradesByDay[key] ?? [];
                const has = !!summary;
                const pos = has && summary!.pnl > 0;
                const neg = has && summary!.pnl < 0;

                return (
                  <div
                    key={idx}
                    className={cls(
                      "calendar-day-cell",
                      "calendar-day-cell-big",
                      has && "calendar-day-has-trades",
                      pos && "calendar-day-pos",
                      neg && "calendar-day-neg"
                    )}
                    onClick={() => handleSelectDay(key)}
                    style={{ cursor: has ? "pointer" : "default" }}
                  >
                    {/* Número de día */}
                    <div className="calendar-day-number-big">
                      {day}
                    </div>

                    {/* Resumen diario */}
                    {summary && (
                      <div className="calendar-day-info-big">
                        <div className="calendar-day-pnl-big">
                          {fmtUSD.format(summary.pnl)}
                        </div>
                        <div className="calendar-day-count-big">
                          {summary.count}{" "}
                          {summary.count === 1 ? "trade" : "trades"}
                        </div>
                      </div>
                    )}

                    {/* Lista compacta de trades del día */}
                    {trades.length > 0 && (
                      <div className="calendar-day-trades-list">
                        {trades.map((t) => {
                          const pnl = t.pnl_usd_gross ?? 0;
                          const pnlPos = pnl >= 0;
                          return (
                            <div
                              key={t.id}
                              className={pnlPos ? "cal-trade-pos" : "cal-trade-neg"}
                            >
                              {fmtUSD.format(pnl)}{" "}
                              <span className="calendar-trade-symbol">
                                {t.symbol ?? ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Total mensual */}
        <div className="calendar-month-footer">
          <span>Total P&amp;L del mes:&nbsp;</span>
          <span className={monthTotal >= 0 ? "pnl-pos" : "pnl-neg"}>
            {fmtUSD.format(monthTotal)}
          </span>
        </div>
      </div>
    );
  }

  // --------------------- [CAL-5] Render principal ----------------------
  return (
    <>
      <TopNav />

      <main className="container">
        <h1 className="title">Calendar</h1>
        <p className="sub">
          Vista rápida de días verdes/rojos por año. Haz click en un mes para ver el detalle
          y luego en un día para ver todos los trades de ese día.
        </p>

        {err && <div className="err">{err}</div>}

        {/* Barra de año */}
        <div className="calendar-year-bar">
          <button
            type="button"
            className="calendar-year-btn"
            onClick={() => setYear((y) => y - 1)}
          >
            ◀
          </button>
          <div className="calendar-year-label">{year}</div>
          <button
            type="button"
            className="calendar-year-btn"
            onClick={() => setYear((y) => y + 1)}
          >
            ▶
          </button>
        </div>

        {loading && <div>Cargando calendario...</div>}

        {/* [Bloque 1] Grid con los 12 meses */}
        <div className="calendar-grid-year">
          {Array.from({ length: 12 }).map((_, idx) => renderMonthMini(idx))}
        </div>

        {/* [Bloque 2] Detalle del mes seleccionado */}
        <section className="calendar-month-detail">
          {renderMonthBig()}
        </section>

        {/* [Bloque 3] Detalle de trades del día seleccionado */}
        <section className="calendar-day-detail">
          <h2 className="calendar-day-detail-title">
            Trades del día seleccionado
          </h2>

          {!selectedDayKey && (
            <p className="calendar-day-detail-empty">
              Haz click en un día con trades en el calendario para ver el detalle aquí.
            </p>
          )}

          {selectedDayKey && (
            <>
              <p className="calendar-day-detail-date">
                Día: <strong>{selectedDayKey}</strong> ·{" "}
                {selectedTrades.length} trade
                {selectedTrades.length === 1 ? "" : "s"}
              </p>

              {selectedTrades.length === 0 && (
                <p className="calendar-day-detail-empty">
                  No hay trades registrados para este día.
                </p>
              )}

              {selectedTrades.length > 0 && (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="table-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Símbolo</th>
                          <th>Lado</th>
                          <th>Vol</th>
                          <th>Entry</th>
                          <th>Exit</th>
                          <th>Open (UTC-7)</th>
                          <th>Close (UTC-7)</th>
                          <th>$P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTrades.map((t) => {
                          const pnl = t.pnl_usd_gross ?? 0;
                          const pnlPos = pnl >= 0;
                          return (
                            <tr key={t.id}>
                              <td>
                                <a href={`/trades/${t.id}`} className="link">
                                  {t.ticket}
                                </a>
                              </td>
                              <td>{t.symbol}</td>
                              <td>{t.side}</td>
                              <td className="num">
                                {t.volume == null ? "" : t.volume}
                              </td>
                              <td className="num">
                                {t.entry_price == null ? "" : t.entry_price}
                              </td>
                              <td className="num">
                                {t.exit_price == null ? "" : t.exit_price}
                              </td>
                              <td>{asDT(t.dt_open_utc)}</td>
                              <td>{asDT(t.dt_close_utc)}</td>
                              <td className={pnlPos ? "pnl-pos num" : "pnl-neg num"}>
                                {t.pnl_usd_gross == null
                                  ? ""
                                  : fmtUSD.format(t.pnl_usd_gross)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

