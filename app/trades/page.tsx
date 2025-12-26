// ===================== [2] /trades/page.tsx =====================
// - Barra TopNav arriba
// - Filtros por símbolo/EA/sesión/Fecha
// - Búsqueda exacta por Ticket y por Bitlog ID (numérico)
// - Paginación de 50 en 50 con "páginaActual/totalPáginas"
// - Ordenación en cliente por encabezado
// - Links a show (/trades/[id]) y a editar (/trades/[id]/edit)
// - FIX: paginación por OFFSET (range) para no "perder" trades
// ================================================================

"use client";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";
import TopNav from "@/components/TopNav";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";  // 👈 AÑADE ESTA LÍNEA



// ...resto de tus imports que ya tengas...


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

type OrderKey =
  | "dt_open_utc"
  | "ticket"
  | "symbol"
  | "side"
  | "volume"
  | "pnl_usd_gross";

// ---------- Helpers de formato (fechas, dinero, números) ----------

// Fechas en tu zona (America/Mazatlan = UTC-7)
const fmtDT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mazatlan",
});

const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const fmtNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 });

const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");

const asDT = (s: string | null) => (s ? fmtDT.format(new Date(s)) : "");


function addDaysYYYYMMDD(d: string, days: number) {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + days, 0, 0, 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const ddd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${ddd}`;
}

// Rango [fromInclusive, toExclusive) en UTC ISO
function mazatlanRangeToUtc(fromYYYYMMDD: string, toYYYYMMDD: string) {
  const fromUtc = `${fromYYYYMMDD}T07:00:00.000Z`;
  const toNext = addDaysYYYYMMDD(toYYYYMMDD, 1);
  const toUtcExclusive = `${toNext}T07:00:00.000Z`;
  return { fromUtc, toUtcExclusive };
}





function addDays(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function mazatlanDayRangeUtc(dateStr: string) {
  // 00:00 Mazatlán == 07:00Z
  const from = `${dateStr}T07:00:00.000Z`;
  const to = `${addDays(dateStr, 1)}T07:00:00.000Z`;
  return { from, to };
}


export default function TradesPage() {
  // ---------- Supabase ----------
  const [sb] = React.useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  // ---------- Config paginación ----------
  const PAGE = 50;

  // ---------- Estados de búsqueda/paginación ----------
  const [qTicket, setQTicket] = React.useState<string>("");
  const [qId, setQId] = React.useState<string>(""); // Bitlog ID
  
  const [filterDateDraft, setFilterDateDraft] = React.useState<string>("");
  const [filterDate, setFilterDate] = React.useState<string>("");

  
  const [total, setTotal] = React.useState<number>(0);
  const [pageIdx, setPageIdx] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);

  const [user, setUser] = React.useState<any>(null);
  const [rows, setRows] = React.useState<Trade[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [symbols, setSymbols] = React.useState<string[]>([]);
  const [eas, setEas] = React.useState<string[]>([]);
  const [sessions, setSessions] = React.useState<string[]>([]);
  const [fSymbol, setFSymbol] = React.useState<string>("");
  
  const [fDateFrom, setFDateFrom] = React.useState<string>(""); // YYYY-MM-DD
  const [fDateTo, setFDateTo]     = React.useState<string>(""); // YYYY-MM-DD

 
  
  const [fEA, setFEA] = React.useState<string>("");
  const [fSession, setFSession] = React.useState<string>("");

  const [orderBy, setOrderBy] = React.useState<OrderKey>("dt_open_utc");
  const [orderAsc, setOrderAsc] = React.useState<boolean>(false);

  const [noMore, setNoMore] = React.useState(false);

  // ---------- Soporte querystring (?ticket=..., ?id=...) ----------
  const initialRef = React.useRef<{ ticket: string | null; id: string | null }>({
    ticket: null,
    id: null,
  });
  React.useEffect(() => {
    const u = new URL(window.location.href);
    initialRef.current = {
      ticket: u.searchParams.get("ticket"),
      id: u.searchParams.get("id"),
    };
    if (initialRef.current.ticket) setQTicket(initialRef.current.ticket);
    if (initialRef.current.id) setQId(initialRef.current.id);
  }, []);

  // ---------- Carga inicial ----------
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ses = await sb.auth.getSession();
        const me = ses.data.session?.user ?? null;
        setUser(me);
        if (!me) {
          setErr("No hay sesión. Entra a /login");
          setLoading(false);
          return;
        }

        // catálogos rápidos (únicos no nulos)
        const [{ data: sym }, { data: ea }, { data: sesh }] = await Promise.all([
          sb.from("trades").select("symbol").not("symbol", "is", null),
          sb.from("trades").select("ea").not("ea", "is", null),
          sb.from("trades").select("session").not("session", "is", null),

        ]);
        const uniq = (xs: any[] | null | undefined, k: string) =>
          Array.from(new Set((xs ?? []).map((x: any) => x[k]))).filter(Boolean).sort();
        setSymbols(uniq(sym, "symbol"));
        setEas(uniq(ea, "ea"));


setSessions(uniq(sesh, "session"));


        // primera carga con filtros iniciales
        await applyFilters();
      } catch (e: any) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Helpers de filtros comunes ----------
  function applyCommonFilters(q: any, ov?: Partial<{
  fSymbol: string; fEA: string; fSession: string;
  qTicket: string; qId: string;
  fDateFrom: string; fDateTo: string;
  filterDate: string;
}>) {
  const _fSymbol  = ov?.fSymbol  ?? fSymbol;
  const _fEA      = ov?.fEA      ?? fEA;
  const _fSession = ov?.fSession ?? fSession;
  const _qTicket  = ov?.qTicket  ?? qTicket;
  const _qId      = ov?.qId      ?? qId;
  const _from     = ov?.fDateFrom ?? fDateFrom;
  const _to       = ov?.fDateTo   ?? fDateTo;
  const _legacy   = ov?.filterDate ?? filterDate;

  if (_fSymbol) q = q.eq("symbol", _fSymbol);
  if (_fEA) q = q.eq("ea", _fEA);
  if (_fSession) q = q.eq("session", _fSession);

const hasTicketOv = !!ov && Object.prototype.hasOwnProperty.call(ov, "qTicket");
const tkt = (hasTicketOv ? _qTicket : (_qTicket || initialRef.current.ticket || "")).trim();

  if (tkt) q = q.eq("ticket", tkt);

const hasIdOv = !!ov && Object.prototype.hasOwnProperty.call(ov, "qId");
const idRaw = (hasIdOv ? _qId : (_qId || initialRef.current.id || "")).trim();

  if (idRaw && /^\d+$/.test(idRaw)) q = q.eq("id", Number(idRaw));

  // rango (nuevo)
  if (_from && _to) {
    const { fromUtc, toUtcExclusive } = mazatlanRangeToUtc(_from, _to);
    q = q.gte("dt_open_utc", fromUtc).lt("dt_open_utc", toUtcExclusive);
  } else if (_from && !_to) {
    const { fromUtc, toUtcExclusive } = mazatlanRangeToUtc(_from, _from);
    q = q.gte("dt_open_utc", fromUtc).lt("dt_open_utc", toUtcExclusive);
  } else if (!_from && _to) {
    const { fromUtc, toUtcExclusive } = mazatlanRangeToUtc(_to, _to);
    q = q.gte("dt_open_utc", fromUtc).lt("dt_open_utc", toUtcExclusive);
  }

  // legacy (si lo dejas)
  if (_legacy) {
    const { from, to } = mazatlanDayRangeUtc(_legacy);
    q = q.gte("dt_open_utc", from).lt("dt_open_utc", to);
  }

  return q;
}


  // ---------- Trae total real y totalPages ----------
async function fetchTotal(ov?: any) {
  let q = sb.from("trades").select("id", { count: "exact", head: true });
  q = applyCommonFilters(q, ov);

  const { count, error } = await q;
  if (error) throw new Error(error.message);

  const t = count ?? 0;
  setTotal(t);
  const pages = Math.max(1, Math.ceil(t / PAGE));
  setTotalPages(pages);
  return t;
}



  // ---------- Cargar página usando OFFSET (range) ----------
async function loadPage(reset = false, ov?: any): Promise<boolean> {

    setLoading(true);
    setErr(null);
    try {
      let q = sb
        .from("trades")
        .select(
          "id,ticket,symbol,side,volume,entry_price,exit_price,dt_open_utc,dt_close_utc,ea,session,pnl_usd_gross"
        )
        .order("dt_open_utc", { ascending: false })
        .order("id", { ascending: false });

        q = applyCommonFilters(q, ov);


      const from = reset ? 0 : rows.length;
      const to = from + PAGE - 1;
      q = q.range(from, to);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const got = (data ?? []) as Trade[];
      if (reset) {
        setRows(got);
      } else {
        setRows((prev) => [...prev, ...got]);
      }

      // si ya llegamos o sobrepasamos el total, marcamos noMore
      const newCount = (reset ? 0 : rows.length) + got.length;
      if (total > 0) {
        setNoMore(newCount >= total);
      } else {
        setNoMore(got.length < PAGE);
      }

      return got.length > 0;
    } catch (e: any) {
      setErr(String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  // ---------- Aplicar filtros (resetea) ----------
  async function applyFilters(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setNoMore(false);
    setPageIdx(1);
    await fetchTotal();
    await loadPage(true);
  }
  
  
  
  
  
  
  
  
  
  
  
  async function clearFilters() {
  setFSymbol("");
  setFEA("");
  setFSession("");
  setQId("");
  setQTicket("");
  setFDateFrom("");
  setFDateTo("");
  setFilterDateDraft("");
  setFilterDate("");
  setNoMore(false);
  setPageIdx(1);

  const ov = {
    fSymbol: "",
    fEA: "",
    fSession: "",
    qTicket: "",
    qId: "",
    fDateFrom: "",
    fDateTo: "",
    filterDate: "",
  };

  await fetchTotal(ov);
  await loadPage(true, ov);
}
















  // ---------- Cargar más ----------
  async function handleLoadMore() {
    const ok = await loadPage(false);
    if (ok) {
      setPageIdx((p) => Math.min(totalPages, p + 1));
    }
  }

  // ---------- Ordenación cliente ----------
  function toggleSort(k: OrderKey) {
    if (orderBy === k) setOrderAsc((x) => !x);
    else {
      setOrderBy(k);
      setOrderAsc(true);
    }
  }

  const viewRows = React.useMemo(() => {
    const xs = [...rows];
    xs.sort((a: any, b: any) => {
      const av = a[orderBy],
        bv = b[orderBy];
      if (av == null && bv == null) return 0;
      if (av == null) return orderAsc ? -1 : 1;
      if (bv == null) return orderAsc ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number")
        return orderAsc ? av - bv : bv - av;
      return orderAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return xs;
  }, [rows, orderBy, orderAsc]);


  // ---------- Eliminar [D1] ----------
  async function onDelete(id: number) {
    if (!confirm("¿Seguro que quieres borrar este trade y sus imágenes?")) return;

    // [D1.1] Obtener token de sesión para llamar a la función delete_trade
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;

    if (!token) {
      alert("No hay sesión válida. Inicia sesión.");
      return;
    }

    const resp = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete_trade`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trade_id: id }),
      }
    );

    if (!resp.ok) {
      const info = await resp.json().catch(() => ({}));
      console.error("delete_trade error", info);
      alert("Error borrando trade.");
      return;
    }

    // [D1.2] ÉXITO: actualizar estado local sin recargar la página
    // - Quitamos el trade del array de rows
    // - Ajustamos contador total y páginas
    setRows((prev) => prev.filter((r) => r.id !== id));

    const newTotal = Math.max(0, total - 1);
    setTotal(newTotal);
    setTotalPages(Math.max(1, Math.ceil(newTotal / PAGE)));
    // No tocamos pageIdx ni noMore: el usuario sigue en la misma vista, solo sin ese trade.
  }


  // ---------- UI ----------
  return (
    <>
      <TopNav />
      
      <div className="container">
  <div className="card" style={{ padding: 16 }}>

          
 {/* Fila inferior de filtros: Fecha + BitlogID + Ticket + Resultado (misma línea) */}

<div
  style={{
    display: "flex",
    gap: 12,
    alignItems: "end",
    flexWrap: "wrap",
  }}
>

    
    {/* Filtros principales */}
<div>
  <label className="small">Símbolo</label>
  <select
    className="select"
    value={fSymbol}
    onChange={(e) => setFSymbol(e.target.value)}
  >
    <option value="">(Todos)</option>
    {symbols.map((s) => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>
</div>

<div>
  <label className="small">EA</label>
  <select
    className="select"
    value={fEA}
    onChange={(e) => setFEA(e.target.value)}
  >
    <option value="">(Todos)</option>
    {eas.map((s) => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>
</div>

<div>
  <label className="small">Sesión</label>
  <select
    className="select"
    value={fSession}
    onChange={(e) => setFSession(e.target.value)}
  >
    <option value="">(Todas)</option>
    {sessions.map((s) => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>
</div>

<div style={{ display: "flex", alignItems: "end" }}>
  <button className="btn primary" type="button" onClick={applyFilters}>
  Aplicar
</button>

  
  


  <button className="btn" type="button" onClick={clearFilters}>
  Limpiar
</button>

  
  
  
  
</div>

{/* Bitlog ID */}
<form
  onSubmit={applyFilters}
  style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}
>
  <div>
    <label className="small">Bitlog ID</label>
    <input
      className="input"
      value={qId}
      onChange={(e) => setQId(e.target.value)}
      placeholder="Ej. 361"
      inputMode="numeric"
      pattern="\d*"
      title="Solo números"
      style={{ width: 130 }}
    />
  </div>
  <div>
    <button className="btn" type="submit" style={{ height: 34 }}>
      🔍
    </button>
  </div>
</form>

{/* Ticket (broker) */}
<form
  onSubmit={applyFilters}
  style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}
>
  <div>
    <label className="small">Ticket (broker)</label>
    <input
      className="input"
      value={qTicket}
      onChange={(e) => setQTicket(e.target.value)}
      placeholder="Ej. 476665"
      style={{ width: 180 }}
    />
  </div>
  <div>
    <button className="btn" type="submit" style={{ height: 34 }}>
      🔍
    </button>
  </div>
</form>




{/* Rango de fechas (Open) + lupa SOLO para fechas */}
<form
  onSubmit={applyFilters}
  style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}
>

  <div>
    <label className="small">Fecha (desde)</label>
    <input
      type="date"
      className="input"
      value={fDateFrom}
      onChange={(e) => setFDateFrom(e.target.value)}
      style={{ width: 160 }}
    />
  </div>

  <div>
    <label className="small">Fecha (hasta)</label>
    <input
      type="date"
      className="input"
      value={fDateTo}
      onChange={(e) => setFDateTo(e.target.value)}
      style={{ width: 160 }}
    />
  </div>
  <div>
    <button className="btn" type="submit" style={{ height: 34 }}>
      🔍
    </button>
    
  </div>
</form>


{/* Resultado a la derecha, misma línea (sin romper grid) */}
<div style={{ display: "flex", alignItems: "end", justifyContent: "flex-end" }}>







  <div style={{ color: "#ffffff", paddingBottom: 6 }}>
    Resultado: {total} trade{total === 1 ? "" : "s"}
  </div>
</div>

</div>
 
          {/* Tabla */}
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {[
                    ["ticket", "Ticket"],
                    ["symbol", "Símbolo"],
                    ["side", "Lado"],
                    ["volume", "Vol"],
                    ["entry_price", "Entry"],
                    ["exit_price", "Exit"],
                    ["dt_open_utc", "Open (UTC -7)"],
                    ["dt_close_utc", "Close (UTC -7)"],
                    ["pnl_usd_gross", "$P&L"],
                  ].map(([k, label]) => (
                    <th key={k} onClick={() => toggleSort(k as OrderKey)}>
                      {label}
                      {orderBy === k ? (orderAsc ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/trades/${r.id}`} className="link">
                        {r.ticket}
                      </a>
                    </td>
                    <td>{r.symbol}</td>
                    <td>{r.side}</td>
                    <td className="num">
                      {r.volume == null ? "" : fmtNum.format(r.volume)}
                    </td>
                    <td className="num">
                      {r.entry_price == null ? "" : fmtNum.format(r.entry_price)}
                    </td>
                    <td className="num">
                      {r.exit_price == null ? "" : fmtNum.format(r.exit_price)}
                    </td>
                    <td>{asDT(r.dt_open_utc)}</td>
                    <td>{asDT(r.dt_close_utc)}</td>
                    <td
                      className={cls(
                        "num",
                        (r.pnl_usd_gross ?? 0) >= 0 ? "pnl-pos" : "pnl-neg"
                      )}
                    >
                      {r.pnl_usd_gross == null
                        ? ""
                        : fmtUSD.format(r.pnl_usd_gross)}
                    </td>
                    <td className="actions" style={{ display: "flex", gap: 8 }}>
                      <a className="btn" href={`/trades/${r.id}/edit`}>
                        Editar
                      </a>
                      <button className="btn-del" onClick={() => onDelete(r.id)}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
                {!viewRows.length && !loading && (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        textAlign: "center",
                        padding: "16px",
                        color: "#9ca3af",
                      }}
                    >
                      Sin datos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          <div className="pager">
            <button
              className="btn"
              disabled={loading || noMore}
              onClick={handleLoadMore}
              style={{ opacity: loading || noMore ? 0.5 : 1 }}
            >
              {noMore ? "No hay más" : "Cargar más"}
            </button>

            <div style={{ marginTop: 8, color: "#6b7280" }}>
              {pageIdx}/{totalPages}
            </div>

            {loading && <span style={{ color: "#9ca3af" }}>Cargando…</span>}
          </div>
          
          </div>
  </div>
         
          
   
    </>
  );
}

