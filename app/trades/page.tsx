// ===================== [2] /trades/page.tsx =====================
// [2.1] Cambios mínimos sin tocar tu diseño de tabla:
//  - Importa TopNav y lo muestra arriba.
//  - Ticket es link a /trades/[id].
//  - Soporta ?ticket=XXXX para filtrar por ticket exacto.
//  - (Opcional) botón "Editar" en acciones → /trades/[id]/edit
// =================================================================

"use client";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";
import TopNav from "@/components/TopNav";

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

const fmtDT = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 });

const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const asDT = (s: string | null) => (s ? fmtDT.format(new Date(s)) : "");

export default function TradesPage() {
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

  const [symbols, setSymbols] = React.useState<string[]>([]);
  const [eas, setEas] = React.useState<string[]>([]);
  const [sessions, setSessions] = React.useState<string[]>([]);
  const [fSymbol, setFSymbol] = React.useState<string>("");
  const [fEA, setFEA] = React.useState<string>("");
  const [fSession, setFSession] = React.useState<string>("");

  const [orderBy, setOrderBy] = React.useState<OrderKey>("dt_open_utc");
  const [orderAsc, setOrderAsc] = React.useState<boolean>(false);

  const PAGE = 25;
  const [anchor, setAnchor] = React.useState<{ dt: string | null; id: number | null } | null>(null);
  const [noMore, setNoMore] = React.useState(false);

  // soporte de búsqueda por query ?ticket=XXXX
  const initialTicketRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const u = new URL(window.location.href);
    initialTicketRef.current = u.searchParams.get("ticket");
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ses = await sb.auth.getSession();
        const me = ses.data.session?.user ?? null;
        setUser(me);
        if (!me) { setErr("No hay sesión. Entra a /login"); setLoading(false); return; }

        const [{ data: sym }, { data: ea }, { data: sesh }] = await Promise.all([
          sb.from("trades").select("symbol").not("symbol", "is", null),
          sb.from("trades").select("ea").not("ea", "is", null),
          sb.from("trades").select("session").not("session", "is", null),
        ]);
        const uniq = (xs: any[], k: string) =>
          Array.from(new Set(xs.map((x) => x[k]))).filter(Boolean).sort();
        setSymbols(uniq(sym ?? [], "symbol"));
        setEas(uniq(ea ?? [], "ea"));
        setSessions(uniq(sesh ?? [], "session"));

        await loadPage(true);
      } catch (e: any) { setErr(String(e)); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage(reset=false) {
    setLoading(true); setErr(null);
    try{
      let q = sb.from("trades")
        .select("id,ticket,symbol,side,volume,entry_price,exit_price,dt_open_utc,dt_close_utc,ea,session,pnl_usd_gross")
        .order("dt_open_utc", { ascending:false })
        .order("id", { ascending:false });

      if (fSymbol) q = q.eq("symbol", fSymbol);
      if (fEA)     q = q.eq("ea", fEA);
      if (fSession)q = q.eq("session", fSession);

      // query por ticket (si viene ?ticket=XXXX)
      if (initialTicketRef.current) {
        q = q.eq("ticket", initialTicketRef.current);
      }

      if (!reset && anchor?.dt && anchor?.id) q = q.lt("dt_open_utc", anchor.dt).limit(PAGE);
      else q = q.limit(PAGE);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const got = (data ?? []) as Trade[];
      if (reset) { setRows(got); setNoMore(got.length < PAGE); }
      else { setRows(prev => [...prev, ...got]); setNoMore(got.length < PAGE); }

      const last = got[got.length - 1];
      setAnchor(last ? { dt: last.dt_open_utc, id: last.id } : anchor);
    }catch(e:any){ setErr(String(e)); }
    finally{ setLoading(false); }
  }

  function applyFilters(){ initialTicketRef.current = null; setAnchor(null); setNoMore(false); loadPage(true); }

  function toggleSort(k: OrderKey){
    if (orderBy === k) setOrderAsc(x=>!x);
    else { setOrderBy(k); setOrderAsc(true); }
  }
  const viewRows = React.useMemo(()=> {
    const xs = [...rows];
    xs.sort((a:any,b:any)=>{
      const av=a[orderBy], bv=b[orderBy];
      if (av==null && bv==null) return 0;
      if (av==null) return orderAsc?-1:1;
      if (bv==null) return orderAsc?1:-1;
      if (typeof av==="number" && typeof bv==="number") return orderAsc? av-bv : bv-av;
      return orderAsc? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return xs;
  },[rows,orderBy,orderAsc]);

  async function onDelete(id:number){
    if(!confirm("¿Eliminar este trade?")) return;
    const { error } = await sb.from("trades").delete().eq("id", id);
    if (error) { alert("No se pudo eliminar: "+error.message); return; }
    setRows(prev=>prev.filter(r=>r.id!==id));
  }

  return (
    <>
      <TopNav />
      <div className="container">
        <h1 className="title">Trades</h1>
        {user && <p className="sub">Usuario: {user.email} · uid: {user.id}</p>}
        {err && <p className="err">{err}</p>}

        <div className="card" style={{padding:16}}>
          <div className="filters">
            <div>
              <label className="small">Símbolo</label>
              <select className="select" value={fSymbol} onChange={e=>setFSymbol(e.target.value)}>
                <option value="">(Todos)</option>
                {symbols.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="small">EA</label>
              <select className="select" value={fEA} onChange={e=>setFEA(e.target.value)}>
                <option value="">(Todos)</option>
                {eas.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="small">Sesión</label>
              <select className="select" value={fSession} onChange={e=>setFSession(e.target.value)}>
                <option value="">(Todas)</option>
                {sessions.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:"flex",alignItems:"end"}}>
              <button className="btn primary" onClick={applyFilters}>Aplicar filtros</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
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
                  ].map(([k,label])=>(
                    <th key={k} onClick={()=>toggleSort(k as OrderKey)}>
                      {label}{orderBy===k ? (orderAsc?" ▲":" ▼"):""}
                    </th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map(r=>(
                  <tr key={r.id}>
                    <td><a href={`/trades/${r.id}`} className="link">{r.ticket}</a></td>
                    <td>{r.symbol}</td>
                    <td>{r.side}</td>
                    <td className="num">{r.volume==null?"":fmtNum.format(r.volume)}</td>
                    <td className="num">{r.entry_price==null?"":fmtNum.format(r.entry_price)}</td>
                    <td className="num">{r.exit_price==null?"":fmtNum.format(r.exit_price)}</td>
                    <td>{asDT(r.dt_open_utc)}</td>
                    <td>{asDT(r.dt_close_utc)}</td>
                    <td className={cls("num",(r.pnl_usd_gross ?? 0) >= 0 ? "pnl-pos" : "pnl-neg")}>
                      {r.pnl_usd_gross==null ? "" : fmtUSD.format(r.pnl_usd_gross)}
                    </td>
                    <td className="actions" style={{display:"flex", gap:8}}>
                      <a className="btn" href={`/trades/${r.id}/edit`}>Editar</a>
                      <button className="btn-del" onClick={()=>onDelete(r.id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {!viewRows.length && !loading && (
                  <tr><td colSpan={11} style={{textAlign:"center", padding:"16px", color:"#9ca3af"}}>Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button
              className="btn"
              disabled={loading || noMore}
              onClick={()=>loadPage(false)}
              style={{opacity:(loading||noMore)?0.5:1}}
            >
              {noMore ? "No hay más" : "Cargar más"}
            </button>
            {loading && <span style={{color:"#9ca3af"}}>Cargando…</span>}
          </div>
        </div>
      </div>
    </>
  );
}

