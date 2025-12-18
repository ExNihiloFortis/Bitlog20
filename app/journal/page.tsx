"use client";

import * as React from "react";
import TopNav from "@/components/TopNav";
import { createClient } from "@supabase/supabase-js";

// ===================== [JRN-1] Tipos =====================
type JournalEntry = {
  id: string;
  entry_date: string; // YYYY-MM-DD (date)
  content: string;
  created_at: string | null;
  updated_at: string | null;
};

type DaySummary = {
  key: string;
  count: number; // 1
};

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];


// YYYY-MM-DD en America/Mazatlan
const fmtDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mazatlan",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtTimeLocal = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mazatlan",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function fmtHHMM_UTC7(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${fmtTimeLocal.format(d)} UTC-7`;
}


function todayKeyLocal(): string {
  return fmtDateKey.format(new Date());
}

const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");

function buildMonthMatrix(year: number, monthIdx0: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIdx0, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();
  const firstWeekday = (first.getUTCDay() + 6) % 7; // 0=Lun..6=Dom

  const weeks: (number | null)[][] = [];
  let current = 1 - firstWeekday;

  while (current <= daysInMonth) {
    const row: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(current < 1 || current > daysInMonth ? null : current);
      current++;
    }
    weeks.push(row);
  }
  return weeks;
}

// ===================== [JRN-2] Page =====================
export default function JournalPage() {
  const [sb] = React.useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const now = new Date();
  const [year, setYear] = React.useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(now.getMonth());

  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [selectedDayKey, setSelectedDayKey] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<string>("");
  const [saving, setSaving] = React.useState<boolean>(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  // --------------------- [JRN-2.1] Load year ---------------------
  React.useEffect(() => {
    let cancelled = false;

    async function loadYear(y: number) {
      setLoading(true);
      setErr(null);

      try {
        const ses = await sb.auth.getSession();
        const me = ses.data.session?.user ?? null;
        if (!me) {
          if (!cancelled) {
            setErr("No hay sesión. Entra a /login");
            setEntries([]);
          }
          return;
        }

        const from = `${y}-01-01`;
        const to = `${y}-12-31`;

        const { data, error } = await sb
          .from("journal_entries")
          .select("id,entry_date,content,created_at,updated_at")
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("entry_date", { ascending: true })
          .order("id", { ascending: true });

        if (error) {
          console.error("journal loadYear error", error);
          if (!cancelled) {
            setErr(error.message);
            setEntries([]);
          }
          return;
        }

        if (!cancelled) {
          setEntries((data ?? []) as JournalEntry[]);
          setSelectedDayKey(null);
          setDraft("");
        }
      } catch (e: any) {
        console.error("journal loadYear exception", e);
        if (!cancelled) {
          setErr(String(e));
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadYear(year);
    return () => {
      cancelled = true;
    };
  }, [sb, year]);

  // --------------------- [JRN-2.2] Derived maps ---------------------
  const entriesByDay = React.useMemo(() => {
    const res: Record<string, JournalEntry> = {};
    for (const e of entries) {
      if (!e.entry_date) continue;
      res[e.entry_date] = e;
    }
    return res;
  }, [entries]);

  const dayMap = React.useMemo(() => {
    const map: Record<string, DaySummary> = {};
    for (const e of entries) {
      const key = e.entry_date;
      if (!key) continue;
      map[key] = { key, count: 1 };
    }
    return map;
  }, [entries]);

  const monthPrefix = React.useMemo(
    () => `${year}-${String(selectedMonth + 1).padStart(2, "0")}-`,
    [year, selectedMonth]
  );

  // Cuando seleccionas día, carga draft
  React.useEffect(() => {
    if (!selectedDayKey) return;
    setDraft(entriesByDay[selectedDayKey]?.content ?? "");
  }, [selectedDayKey, entriesByDay]);

  // --------------------- [JRN-3] Actions ---------------------
  function handleSelectMonth(monthIdx0: number) {
    setSelectedMonth(monthIdx0);
    setSelectedDayKey(null);
    setDraft("");
    setSaveMsg(null);
  }

  function handleSelectDay(key: string) {
    setSelectedDayKey(key);
    setDraft(entriesByDay[key]?.content ?? "");
    setSaveMsg(null);
  }

  async function handleSaveForDay(key: string) {
    setSaving(true);
    setSaveMsg(null);
    setErr(null);

    try {
      const ses = await sb.auth.getSession();
      const me = ses.data.session?.user ?? null;
      if (!me) {
        setErr("No hay sesión. Entra a /login");
        return;
      }

      const content = (draft ?? "").trim();
      if (!content) {
        setSaveMsg("Nada que guardar (nota vacía).");
        return;
      }

      const { data, error } = await sb
        .from("journal_entries")
        .upsert(
          {
            user_id: me.id,
            entry_date: key,
            content,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,entry_date" }
        )
        .select("id,entry_date,content,created_at,updated_at")
        .single();

      if (error) {
        console.error("journal upsert error", error);
        setErr(error.message);
        return;
      }

      if (data) {
        setEntries((prev) => {
          const next = prev.filter((x) => x.entry_date !== data.entry_date);
          next.push(data as JournalEntry);
          next.sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0));
          return next;
        });
        setSaveMsg("Guardado ✅");
      }
    } catch (e: any) {
      console.error("journal save exception", e);
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteForDay(key: string) {
    if (!confirm(`¿Borrar la nota del día ${key}?`)) return;

    setSaving(true);
    setSaveMsg(null);
    setErr(null);

    try {
      const ses = await sb.auth.getSession();
      const me = ses.data.session?.user ?? null;
      if (!me) {
        setErr("No hay sesión. Entra a /login");
        return;
      }

      // Borrado por (entry_date) + RLS (solo tuyo)
      const { error } = await sb
        .from("journal_entries")
        .delete()
        .eq("entry_date", key);

      if (error) {
        console.error("journal delete error", error);
        setErr(error.message);
        return;
      }

      setEntries((prev) => prev.filter((x) => x.entry_date !== key));
      if (selectedDayKey === key) {
        setSelectedDayKey(null);
        setDraft("");
      }
      setSaveMsg("Borrado ✅");
    } catch (e: any) {
      console.error("journal delete exception", e);
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  // --------------------- [JRN-4] Render helpers ---------------------
  function renderMonthMini(monthIdx0: number) {
    const matrix = buildMonthMatrix(year, monthIdx0);
    const active = monthIdx0 === selectedMonth;

    return (
      <button
        key={monthIdx0}
        type="button"
        className={cls("calendar-month-mini", active && "calendar-month-mini-active")}
        onClick={() => handleSelectMonth(monthIdx0)}
      >
        <div className="calendar-month-name">{MONTH_NAMES[monthIdx0]}</div>

        <div className="calendar-week-header">
          {WEEK_LABELS.map((w, i) => (
            <div key={`${w}-${i}`} className="calendar-week-cell">
              {w}
            </div>
          ))}
        </div>

        <div className="calendar-weeks">
          {matrix.map((week, i) => (
            <div key={i} className="calendar-week-row">
              {week.map((day, idx) => {
                if (!day) return <div key={idx} className={cls("calendar-day-cell", "calendar-day-empty")} />;
                const key = `${year}-${String(monthIdx0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const has = !!dayMap[key];

                return (
                  <div
                    key={idx}
                    className={cls("calendar-day-cell", "calendar-day-mini", has && "calendar-day-has-trades")}
                    title={has ? "Hay nota" : ""}
                  >
                    <div className="calendar-day-number-mini">{day}</div>
                    {has && <div className="jrn-dot" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </button>
    );
  }

  function renderMonthBig() {
    const matrix = buildMonthMatrix(year, selectedMonth);
    const monthName = MONTH_NAMES[selectedMonth];

    return (
      <div className="calendar-month-big">
        <div className="calendar-month-detail-title">
          {monthName} {year}
        </div>

        <div className="calendar-week-header calendar-week-header-big">
          {WEEK_LABELS.map((w, i) => (
            <div key={`${w}-${i}`} className="calendar-week-cell">
              {w}
            </div>
          ))}
        </div>

        <div className="calendar-weeks calendar-weeks-big">
          {matrix.map((week, i) => (
            <div key={i} className="calendar-week-row calendar-week-row-big">
              {week.map((day, idx) => {
                if (!day) return <div key={idx} className={cls("calendar-day-cell", "calendar-day-empty")} />;
                const key = `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const has = !!dayMap[key];
                const isSel = selectedDayKey === key;

                return (
                  <div
                    key={idx}
                    className={cls(
                      "calendar-day-cell",
                      "calendar-day-cell-big",
                      has && "calendar-day-has-trades",
                      isSel && "calendar-day-selected"
                    )}
                    onClick={() => handleSelectDay(key)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="calendar-day-number-big">{day}</div>
                    {has && <div className="jrn-dot" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="calendar-month-footer">
          <span>Días con nota en el mes:&nbsp;</span>
          <span className="pnl-pos">{Object.keys(dayMap).filter((k) => k.startsWith(monthPrefix)).length}</span>
        </div>
      </div>
    );
  }

  // --------------------- [JRN-5] Main render ---------------------
  const effectiveKey = selectedDayKey ?? todayKeyLocal();
  const hasSelected = !!entriesByDay[effectiveKey];
  
  const entryForKey = entriesByDay[effectiveKey];

  const timeLabel =
    fmtHHMM_UTC7(entryForKey?.updated_at) ??
    fmtHHMM_UTC7(entryForKey?.created_at);


  return (
    <>
      <TopNav />

      <main className="container">
        <h1 className="title">Journal</h1>
        <p className="sub">Notas personales del día (psicología, lecciones, observaciones).</p>

        {err && <div className="err">{err}</div>}

        {/* Formulario: ancho completo */}
        <section className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontWeight: 800 }}>Entrada del día</div>
              
              
              <div className="muted" style={{ marginTop: 2 }}>
  Día objetivo: <span style={{ fontFamily: "monospace" }}>{effectiveKey}</span>
  {timeLabel ? (
    <> / <span style={{ fontFamily: "monospace" }}>{timeLabel}</span></>
  ) : (
    <> / <span style={{ fontFamily: "monospace" }}>--:-- UTC-7</span></>
  )}
</div>

              
              
              
              
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" className="btn" onClick={() => handleSaveForDay(effectiveKey)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>

              <button
                type="button"
                className="btn secondary"
                onClick={() => handleDeleteForDay(effectiveKey)}
                disabled={saving || !hasSelected}
                title={!hasSelected ? "No hay nota para borrar" : "Borrar nota"}
              >
                Borrar
              </button>
            </div>
          </div>

          <textarea
            className="input"
            style={{ marginTop: 10, minHeight: 220, width: "100%", resize: "vertical" }}
            placeholder="Escribe tu nota del día: qué aprendiste, qué viste, qué sentiste, qué harás distinto mañana..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          {saveMsg && <div className="ok" style={{ marginTop: 8 }}>{saveMsg}</div>}
        </section>

        <div className="calendar-year-bar">
          <button type="button" className="calendar-year-btn" onClick={() => setYear((y) => y - 1)}>◀</button>
          <div className="calendar-year-label">{year}</div>
          <button type="button" className="calendar-year-btn" onClick={() => setYear((y) => y + 1)}>▶</button>
        </div>

        {loading && <div>Cargando journal...</div>}

        {/* Bloque 1 */}
        <div className="calendar-grid-year">
          {Array.from({ length: 12 }).map((_, idx) => renderMonthMini(idx))}
        </div>

        {/* Bloque 2 */}
        <section className="calendar-month-detail">{renderMonthBig()}</section>

        {/* Bloque 3 */}
        <section className="calendar-day-detail">
          <h2 className="calendar-day-detail-title">Nota del día</h2>

          {selectedDayKey && (
            <div className="card" style={{ padding: 14, marginTop: 8 }}>
            
            
            
            
            
           <div className="muted" style={{ marginBottom: 8 }}>
  Día: <strong>{selectedDayKey}</strong>
  {timeLabel ? (
    <> / <strong>{timeLabel}</strong></>
  ) : (
    <> / <strong>--:-- UTC-7</strong></>
  )}
</div>

              
              
              
              
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {entriesByDay[selectedDayKey]?.content?.trim()
                  ? entriesByDay[selectedDayKey].content
                  : "No hay nota guardada para este día (aún)."}
              </div>
            </div>
          )}

          {!selectedDayKey && (
            <p className="calendar-day-detail-empty">
              Tip: haz click en un día del calendario. Si no existe nota, puedes crearla arriba.
            </p>
          )}
        </section>
      </main>

      {/* Dot amarillo + selected */}
      <style jsx global>{`
        .jrn-dot{
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #f5c84c;
          margin-top: 4px;
          box-shadow: 0 0 0 1px rgba(0,0,0,.25);
        }
        .calendar-day-selected{
          outline: 2px solid rgba(245,200,76,.65);
          outline-offset: -2px;
        }
      `}</style>
    </>
  );
}

