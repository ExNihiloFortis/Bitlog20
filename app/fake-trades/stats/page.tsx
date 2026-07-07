"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { supabase } from "@/lib/supabaseClient";

export default function FakeTradeStatsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("fake_trades")
        .select("id,symbol,result,source_type,source_name,pattern_name,timeframe,created_at")
        .order("created_at", { ascending: false });
      if (error) alert("Error cargando stats: " + error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const s = useMemo(() => {
    const total = rows.length;
    const closed = rows.filter((r) => ["WIN", "LOSS", "NEUTRAL"].includes(r.result));
    const win = rows.filter((r) => r.result === "WIN").length;
    const loss = rows.filter((r) => r.result === "LOSS").length;
    const pending = rows.filter((r) => r.result === "PENDING").length;
    const neutral = rows.filter((r) => r.result === "NEUTRAL").length;
    const winRate = win + loss > 0 ? (win / (win + loss)) * 100 : 0;
    const bySource = Object.entries(rows.reduce((a: any, r) => { const k = r.source_type === "EXTERNA" ? (r.source_name || "Externa") : "Propia"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a: any, b: any) => b[1] - a[1]);
    const byPattern = Object.entries(rows.reduce((a: any, r) => { const k = r.pattern_name || "Sin patrón"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a: any, b: any) => b[1] - a[1]);
    return { total, closed: closed.length, win, loss, pending, neutral, winRate, bySource, byPattern };
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
                <Card label="Winrate" value={`${s.winRate.toFixed(1)}%`} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h2 className="title" style={{ fontSize: 18 }}>Por fuente</h2>
                  <table className="tbl"><tbody>{s.bySource.map(([k, v]: any) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}</tbody></table>
                </div>
                <div className="card" style={{ padding: 16 }}>
                  <h2 className="title" style={{ fontSize: 18 }}>Por patrón</h2>
                  <table className="tbl"><tbody>{s.byPattern.map(([k, v]: any) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}</tbody></table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
