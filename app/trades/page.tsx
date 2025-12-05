// ===================== [2] /trades/page.tsx =====================
// - Barra TopNav arriba
// - Filtros por símbolo/EA/sesión
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

const fmtDT = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
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
  function applyCommonFilters(q: any) {
    if (fSymbol) q = q.eq("symbol", fSymbol);
    if (fEA) q = q.eq("ea", fEA);
    if (fSession) q = q.eq("session", fSession);

    // ticket si viene en input o en URL
    const tkt = (qTicket || initialRef.current.ticket || "").trim();
    if (tkt) q = q.eq("ticket", tkt);

    // id numérico si viene en input o en URL
    const idRaw = (qId || initialRef.current.id || "").trim();
    if (idRaw && /^\d+$/.test(idRaw)) {
      q = q.eq("id", Number(idRaw));
    }
    return q;
  }

  // ---------- Trae total real y totalPages ----------
  async function fetchTotal() {
    let q = sb.from("trades").select("id", { count: "exact", head: true });
    q = applyCommonFilters(q);
    const { count, error } = await q;
    if (!error && typeof count === "number") {
      setTotal(count);
      setTotalPages(Math.max(1, Math.ceil(count / PAGE)));
    }
  }

  // ---------- Cargar página usando OFFSET (range) ----------
  async function loadPage(reset = false): Promise<boolean> {
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

      q = applyCommonFilters(q);

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
        <h1 className="title">Trades</h1>
        {user && <p className="sub">Usuario: {user.email} · uid: {user.id}</p>}
        {err && <p className="err">{err}</p>}

        <div className="card" style={{ padding: 16 }}>
          {/* Filtros principales */}
          <div className="filters">
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
              <button className="btn primary" onClick={applyFilters}>
                Aplicar filtros
              </button>
            </div>

            {/* Búsqueda por Bitlog ID */}
            <form
              onSubmit={applyFilters}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "end",
                flexWrap: "wrap",
              }}
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
                />
              </div>
              <div>
                <button className="btn" type="submit" style={{ height: 34 }}>
                  🔍
                </button>
              </div>
            </form>

            {/* Búsqueda por Ticket */}
            <form
              onSubmit={applyFilters}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "end",
                flexWrap: "wrap",
              }}
            >
              <div>
                <label className="small">Ticket (broker)</label>
                <input
                  className="input"
                  value={qTicket}
                  onChange={(e) => setQTicket(e.target.value)}
                  placeholder="Ej. 476665"
                />
              </div>
              
              <div>
                <button className="btn" type="submit" style={{ height: 34 }}>
                  🔍
                </button>
                
              </div>
            </form>
            
            {/* Resumen de resultados (cuantos trades resultaron del filtrado) */}
              <div style={{ margin: "8px 0", color: "#4b5563" }}>
                 Resultado: {total} trade{total === 1 ? "" : "s"}
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
                    ["dt_open_utc", "Open (UTC)"],
                    ["dt_close_utc", "Close (UTC)"],
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

