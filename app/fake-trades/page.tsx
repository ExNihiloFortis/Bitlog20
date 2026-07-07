"use client";

import * as React from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: number;
  symbol: string;
  side: "BUY" | "SELL" | null;
  timeframe: string | null;
  source_type: "PROPIA" | "EXTERNA" | null;
  source_name: string | null;
  pattern_name: string | null;
  result: "PENDING" | "WIN" | "LOSS" | "NEUTRAL" | null;
  setup_datetime: string | null;
  created_at: string | null;
};

const fmtDT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mazatlan",
});
const asDT = (s: string | null) => (s ? fmtDT.format(new Date(s)) : "");

function badge(result: Row["result"]) {
  const label = result === "WIN" ? "CUMPLIDO" : result === "LOSS" ? "NO" : result === "NEUTRAL" ? "NEUTRAL" : "PENDIENTE";
  const bg = result === "WIN" ? "#0a4" : result === "LOSS" ? "#a00" : result === "NEUTRAL" ? "#555" : "#92400e";
  return <span style={{ padding: "4px 8px", borderRadius: 999, background: bg, color: "#fff", fontWeight: 700, fontSize: 12 }}>{label}</span>;
}

export default function FakeTradesPage() {
  const PAGE = 50;
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);
  const [symbols, setSymbols] = React.useState<string[]>([]);
  const [fSymbol, setFSymbol] = React.useState("");
  const [fResult, setFResult] = React.useState("");
  const [qId, setQId] = React.useState("");
  const [noMore, setNoMore] = React.useState(false);

  React.useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setErr("No hay sesión. Entra a /login");
        return;
      }
      const { data: sym } = await supabase.from("fake_trades").select("symbol").not("symbol", "is", null);
      setSymbols(Array.from(new Set((sym || []).map((x: any) => x.symbol))).filter(Boolean).sort());
      await applyFilters(undefined, true);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function applyCommon(q: any, ov?: any) {
    const symbol = ov?.fSymbol ?? fSymbol;
    const result = ov?.fResult ?? fResult;
    const idRaw = (ov?.qId ?? qId).trim();
    if (symbol) q = q.eq("symbol", symbol);
    if (result) q = q.eq("result", result);
    if (idRaw && /^\d+$/.test(idRaw)) q = q.eq("id", Number(idRaw));
    return q;
  }

  async function fetchTotal(ov?: any) {
    let q = supabase.from("fake_trades").select("id", { count: "exact", head: true });
    q = applyCommon(q, ov);
    const { count, error } = await q;
    if (error) throw error;
    setTotal(count ?? 0);
    return count ?? 0;
  }

  async function loadPage(reset = false, ov?: any) {
    setLoading(true);
    setErr(null);
    try {
      let q = supabase
        .from("fake_trades")
        .select("id,symbol,side,timeframe,source_type,source_name,pattern_name,result,setup_datetime,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      q = applyCommon(q, ov);
      const from = reset ? 0 : rows.length;
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw error;
      const got = (data ?? []) as Row[];
      setRows((prev) => reset ? got : [...prev, ...got]);
      setNoMore(got.length < PAGE);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function applyFilters(e?: React.FormEvent, first = false) {
    e?.preventDefault();
    const ov = first ? { fSymbol: "", fResult: "", qId: "" } : undefined;
    await fetchTotal(ov);
    await loadPage(true, ov);
  }

  async function clearFilters() {
    setFSymbol(""); setFResult(""); setQId(""); setNoMore(false);
    const ov = { fSymbol: "", fResult: "", qId: "" };
    await fetchTotal(ov);
    await loadPage(true, ov);
  }

  async function onDelete(id: number) {
    if (!confirm("¿Borrar este fake trade y sus imágenes?")) return;
    const { data: imgs } = await supabase.from("fake_trade_images").select("id,storage_path").eq("fake_trade_id", id);
    const paths = (imgs || []).map((x: any) => x.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from("journal").remove(paths);
    await supabase.from("fake_trade_images").delete().eq("fake_trade_id", id);
    const { error } = await supabase.from("fake_trades").delete().eq("id", id);
    if (error) { alert("Error borrando: " + error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card" style={{ padding: 16 }}>
          <div className="head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h1 className="title">Fake Trades</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn secondary" href="/fake-trades/stats">Stats</a>
              <a className="btn primary" href="/fake-trades/new">Nuevo</a>
            </div>
          </div>

          <form onSubmit={applyFilters} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <label className="small">Símbolo</label>
              <select className="select" value={fSymbol} onChange={(e) => setFSymbol(e.target.value)}>
                <option value="">(Todos)</option>
                {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="small">Resultado</label>
              <select className="select" value={fResult} onChange={(e) => setFResult(e.target.value)}>
                <option value="">(Todos)</option>
                <option value="PENDING">Pendiente</option>
                <option value="WIN">Cumplido</option>
                <option value="LOSS">No cumplido</option>
                <option value="NEUTRAL">Neutral</option>
              </select>
            </div>
            <div>
              <label className="small">ID</label>
              <input className="input" value={qId} onChange={(e) => setQId(e.target.value)} style={{ width: 120 }} />
            </div>
            <button className="btn primary" type="submit">Aplicar</button>
            <button className="btn" type="button" onClick={clearFilters}>Limpiar</button>
            <div style={{ marginLeft: "auto", color: "#fff", paddingBottom: 6 }}>Resultado: {total}</div>
          </form>

          {err && <div style={{ color: "#fca5a5", marginBottom: 8 }}>{err}</div>}

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th><th>Símbolo</th><th>Lado</th><th>TF</th><th>Origen</th><th>Patrón</th><th>Fecha</th><th>Resultado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><a className="link" href={`/fake-trades/${r.id}`}>#{r.id}</a></td>
                    <td>{r.symbol}</td>
                    <td>{r.side}</td>
                    <td>{r.timeframe}</td>
                    <td>{r.source_type === "EXTERNA" ? (r.source_name || "Externa") : "Propia"}</td>
                    <td>{r.pattern_name}</td>
                    <td>{asDT(r.setup_datetime || r.created_at)}</td>
                    <td>{badge(r.result)}</td>
                    <td className="actions" style={{ display: "flex", gap: 8 }}>
                      <a className="btn" href={`/fake-trades/${r.id}/edit`}>Editar</a>
                      <button className="btn-del" type="button" onClick={() => onDelete(r.id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {!rows.length && !loading && <tr><td colSpan={9} style={{ textAlign: "center", padding: 16, color: "#9ca3af" }}>Sin datos</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button className="btn" disabled={loading || noMore} onClick={() => loadPage(false)} style={{ opacity: loading || noMore ? 0.5 : 1 }}>
              {noMore ? "No hay más" : "Cargar más"}
            </button>
            {loading && <span style={{ color: "#9ca3af" }}>Cargando…</span>}
          </div>
        </div>
      </div>
    </>
  );
}
