// [BLOQUE 1] Client + deps ----------------------------------------------------
"use client";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";

// [BLOQUE 2] Tipos ------------------------------------------------------------
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

type OrderKey = "dt_open_utc" | "ticket" | "symbol" | "side" | "volume" | "pnl_usd_gross";

// [BLOQUE 3] Helpers ----------------------------------------------------------
const fmt = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDT(s: string | null) {
  if (!s) return "";
  try { return fmt.format(new Date(s)); } catch { return s; }
}

function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// [BLOQUE 4] Página ------------------------------------------------------------
export default function TradesPage() {
  // estado base
  const [sb] = React.useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [user, setUser] = React.useState<any>(null);
  const [rows, setRows] = React.useState<Trade[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // filtros
  const [symbols, setSymbols] = React.useState<string[]>([]);
  const [eas, setEas] = React.useState<string[]>([]);
  const [sessions, setSessions] = React.useState<string[]>([]);
  const [fSymbol, setFSymbol] = React.useState<string>("");   // filtro símbolo
  const [fEA, setFEA] = React.useState<string>("");           // filtro EA
  const [fSession, setFSession] = React.useState<string>(""); // filtro sesión

  // orden
  const [orderBy, setOrderBy] = React.useState<OrderKey>("dt_open_utc");
  const [orderAsc, setOrderAsc] = React.useState<boolean>(false);

  // paginación (keyset por dt_open_utc,id desc)
  const PAGE = 25;
  const [anchor, setAnchor] = React.useState<{dt: string | null, id: number | null} | null>(null);
  const [noMore, setNoMore] = React.useState(false);

  // [BLOQUE 4.1] Cargar sesión + combos + primera página ----------------------
  React.useEffect(() => { (async () => {
    try {
      setLoading(true);
      const ses = await sb.auth.getSession();
      const me = ses.data.session?.user ?? null;
      setUser(me);
      if (!me) { setErr("No hay sesión. Entra a /login"); setLoading(false); return; }

      // combos (de toda la BD del usuario)
      const [{ data: sym }, { data: ea }, { data: sesh }] = await Promise.all([
        sb.from("trades").select("symbol").not("symbol", "is", null),
        sb.from("trades").select("ea").not("ea", "is", null),
        sb.from("trades").select("session").not("session", "is", null),
      ]);

      const uniq = (xs: any[]) => Array.from(new Set(xs.map(x => (x as any)[Object.keys(x)[0]]))).filter(Boolean).sort();
      setSymbols(uniq(sym ?? []));
      setEas(uniq(ea ?? []));
      setSessions(uniq(sesh ?? []));

      // primera página
      await loadPage(true);
    } catch (e:any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  })(); }, []); // eslint-disable-line

  // [BLOQUE 4.2] Cargar página (reset o siguiente) ----------------------------
  async function loadPage(reset=false) {
    setLoading(true);
    setErr(null);
    try{
      let q = sb.from("trades")
        .select("id,ticket,symbol,side,volume,entry_price,exit_price,dt_open_utc,dt_close_utc,ea,session,pnl_usd_gross");

      // filtros
      if (fSymbol) q = q.eq("symbol", fSymbol);
      if (fEA)     q = q.eq("ea", fEA);
      if (fSession)q = q.eq("session", fSession);

      // orden principal (por UX), pero keyset real por dt_open_utc,id
      // Mostramos orden UI (orderBy/orderAsc) en cliente, y para keyset usamos dt_open_utc,id desc.
      // Traemos SIEMPRE por dt_open_utc desc, id desc para continuidad.
      q = q.order("dt_open_utc", { ascending: false }).order("id", { ascending: false });

      // keyset
      if (!reset && anchor?.dt && anchor?.id) {
        q = q.lt("dt_open_utc", anchor.dt).limit(PAGE);
      } else {
        q = q.limit(PAGE);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const got = (data ?? []) as Trade[];
      if (reset) {
        setRows(got);
        setNoMore(got.length < PAGE);
      } else {
        setRows(prev => [...prev, ...got]);
        setNoMore(got.length < PAGE);
      }

      // actualiza anchor
      const last = got[got.length - 1];
      setAnchor(last ? { dt: last.dt_open_utc, id: last.id } : anchor);

    }catch(e:any){
      setErr(String(e));
    }finally{
      setLoading(false);
    }
  }

  // [BLOQUE 4.3] Re-aplicar filtros (reset lista y anchor)
  function applyFilters() {
    setAnchor(null);
    setNoMore(false);
    loadPage(true);
  }

  // [BLOQUE 4.4] Orden en cliente (clic en cabecera) --------------------------
  function toggleSort(k: OrderKey) {
    if (orderBy === k) setOrderAsc(x => !x);
    else { setOrderBy(k); setOrderAsc(true); }
  }
  const viewRows = React.useMemo(() => {
    const xs = [...rows];
    xs.sort((a,b) => {
      const av = (a as any)[orderBy];
      const bv = (b as any)[orderBy];
      if (av == null && bv == null) return 0;
      if (av == null) return orderAsc ? -1 : 1;
      if (bv == null) return orderAsc ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") return orderAsc ? av - bv : bv - av;
      return orderAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return xs;
  }, [rows, orderBy, orderAsc]);

  // [BLOQUE 4.5] Borrar fila (RLS por dueño) ----------------------------------
  async function onDelete(id: number) {
    if (!confirm("¿Eliminar este trade?")) return;
    const { error } = await sb.from("trades").delete().eq("id", id);
    if (error) { alert("No se pudo eliminar: " + error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
  }

  // [BLOQUE 4.6] UI -----------------------------------------------------------
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Trades</h1>
      {user && <p className="text-sm">Usuario: {user.email} · uid: {user.id}</p>}
      {err && <p className="text-red-600">{err}</p>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs block mb-1">Símbolo</label>
          <select className="border px-2 py-1 rounded min-w-[140px]"
                  value={fSymbol} onChange={e=>setFSymbol(e.target.value)}>
            <option value="">(Todos)</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1">EA</label>
          <select className="border px-2 py-1 rounded min-w-[140px]"
                  value={fEA} onChange={e=>setFEA(e.target.value)}>
            <option value="">(Todos)</option>
            {eas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1">Sesión</label>
          <select className="border px-2 py-1 rounded min-w-[140px]"
                  value={fSession} onChange={e=>setFSession(e.target.value)}>
            <option value="">(Todas)</option>
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={applyFilters} className="px-3 py-2 rounded bg-black text-white">Aplicar filtros</button>
      </div>

      {/* Tabla */}
      <div className="overflow-auto">
        <table className="min-w-[1100px] border-collapse w-full text-sm">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              {[
                ["ticket","Ticket"],
                ["symbol","Símbolo"],
                ["side","Lado"],
                ["volume","Vol"],
                ["entry_price","Entry"],
                ["exit_price","Exit"],
                ["dt_open_utc","Open (UTC)"],
                ["dt_close_utc","Close (UTC)"],
                ["pnl_usd_gross","$P&L"],
              ].map(([k, label])=>(
                <th key={k}
                    className="border p-2 whitespace-nowrap cursor-pointer select-none"
                    onClick={()=>toggleSort(k as OrderKey)}>
                  {label}{orderBy===k ? (orderAsc?" ▲":" ▼"):""}
                </th>
              ))}
              <th className="border p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map(r=>(
              <tr key={r.id} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2">{r.ticket}</td>
                <td className="border p-2">{r.symbol}</td>
                <td className="border p-2">{r.side}</td>
                <td className="border p-2">{r.volume}</td>
                <td className="border p-2">{r.entry_price}</td>
                <td className="border p-2">{r.exit_price}</td>
                <td className="border p-2 whitespace-nowrap">{formatDT(r.dt_open_utc)}</td>
                <td className="border p-2 whitespace-nowrap">{formatDT(r.dt_close_utc)}</td>
                <td className={cls("border p-2 font-medium",
                    (r.pnl_usd_gross ?? 0) >= 0 ? "text-green-600":"text-red-600")}>
                  {r.pnl_usd_gross}
                </td>
                <td className="border p-2">
                  <button onClick={()=>onDelete(r.id)}
                          className="px-2 py-1 rounded bg-red-600 text-white">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {!viewRows.length && !loading && (
              <tr><td className="p-4 text-center" colSpan={11}>Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center gap-3">
        <button disabled={loading || noMore}
                onClick={()=>loadPage(false)}
                className={cls("px-3 py-2 rounded border",
                  loading||noMore ? "opacity-50 cursor-not-allowed":"bg-white")}>
          {noMore ? "No hay más" : "Cargar más"}
        </button>
        {loading && <span>Cargando…</span>}
      </div>
    </div>
  );
}

