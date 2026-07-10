"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

function pct(n: number) { return `${n.toFixed(1)}%`; }
function group(rows: any[], keyFn: (r: any) => string) {
  return Object.entries(rows.reduce((a: any, r) => {
    const k = keyFn(r) || "—";
    if (!a[k]) a[k] = { total: 0, win: 0, loss: 0, neutral: 0, pending: 0 };
    a[k].total += 1;
    if (r.result === "WIN") a[k].win += 1;
    if (r.result === "LOSS") a[k].loss += 1;
    if (r.result === "NEUTRAL") a[k].neutral += 1;
    if (r.result === "PENDING") a[k].pending += 1;
    return a;
  }, {})).map(([k, v]: any) => {
    const closed = v.win + v.loss;
    return { k, ...v, winRate: closed > 0 ? (v.win / closed) * 100 : 0 };
  }).sort((a: any, b: any) => b.total - a.total);
}

function StatTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 className="title" style={{ fontSize: 18 }}>{title}</h2>
      <table className="tbl">
        <thead><tr><th>Grupo</th><th>Total</th><th>Win</th><th>Loss</th><th>Pend.</th><th>Winrate</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.k}><td>{r.k}</td><td className="num">{r.total}</td><td className="num">{r.win}</td><td className="num">{r.loss}</td><td className="num">{r.pending}</td><td className="num">{pct(r.winRate)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function FakeTradeStatsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("fake_trades")
        .select("id,symbol,result,source_type,source_name,pattern_name,timeframe,tendencia,session,candle_name,ea,rsi_value,stochastic_k,adx,rvol,created_at")
        .order("created_at", { ascending: false });
      if (error) alert("Error cargando stats: " + error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const s = useMemo(() => {
    const total = rows.length;
    const win = rows.filter((r) => r.result === "WIN").length;
    const loss = rows.filter((r) => r.result === "LOSS").length;
    const pending = rows.filter((r) => r.result === "PENDING").length;
    const neutral = rows.filter((r) => r.result === "NEUTRAL").length;
    const winRate = win + loss > 0 ? (win / (win + loss)) * 100 : 0;
    return {
      total, win, loss, pending, neutral, winRate,
      bySource: group(rows, (r) => r.source_type === "EXTERNA" ? (r.source_name || "Externa") : "Propia"),
      byPattern: group(rows, (r) => r.pattern_name || "Sin patrón"),
      byTimeframe: group(rows, (r) => r.timeframe || "Sin TF"),
      byTrend: group(rows, (r) => r.tendencia || "Sin tendencia"),
      bySession: group(rows, (r) => r.session || "Sin sesión"),
      byCandle: group(rows, (r) => r.candle_name || "Sin vela"),
      byEA: group(rows, (r) => r.ea || "Sin EA/IA"),
      byRvol: group(rows, (r) => {
        const v = Number(r.rvol);
        if (Number.isNaN(v)) return "Sin RVOL";
        if (v >= 2) return "RVOL >= 2";
        if (v >= 1.5) return "RVOL 1.5-1.99";
        if (v >= 1) return "RVOL 1-1.49";
        return "RVOL < 1";
      }),
      byAdx: group(rows, (r) => {
        const v = Number(r.adx);
        if (Number.isNaN(v)) return "Sin ADX";
        if (v >= 25) return "ADX >= 25";
        if (v >= 20) return "ADX 20-24.99";
        return "ADX < 20";
      }),
    };
  }, [rows]);

  const Card = ({ label, value }: { label: string; value: any }) => (
    <div className="card" style={{ padding: 16 }}><div className="label">{label}</div><div className="value value-strong" style={{ fontSize: 28 }}>{value}</div></div>
  );

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card">
          <div className="head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h1 className="title">Estadísticas Fake Trades</h1>
            <a className="btn secondary" href="/fake-trades">Volver</a>
          </div>

          {loading ? <p>Cargando…</p> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <Card label="Total" value={s.total} />
                <Card label="Cumplidos" value={s.win} />
                <Card label="No cumplidos" value={s.loss} />
                <Card label="Pendientes" value={s.pending} />
                <Card label="Neutrales" value={s.neutral} />
                <Card label="Winrate" value={pct(s.winRate)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginTop: 16 }}>
                <StatTable title="Por fuente" rows={s.bySource} />
                <StatTable title="Por patrón" rows={s.byPattern} />
                <StatTable title="Por timeframe" rows={s.byTimeframe} />
                <StatTable title="Por tendencia" rows={s.byTrend} />
                <StatTable title="Por sesión" rows={s.bySession} />
                <StatTable title="Por vela" rows={s.byCandle} />
                <StatTable title="Por EA / IA / Modelo" rows={s.byEA} />
                <StatTable title="Por RVOL" rows={s.byRvol} />
                <StatTable title="Por ADX" rows={s.byAdx} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
