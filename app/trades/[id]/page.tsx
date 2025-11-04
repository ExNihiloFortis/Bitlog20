// [BLOQUE 1] Imports ----------------------------------------------------------
import 'server-only';
import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// [BLOQUE 2] Tipos y helpers --------------------------------------------------
type Trade = {
  id: number; ticket: string; symbol: string; side: string;
  entry_price: number|null; exit_price: number|null;
  dt_open_utc: string; dt_close_utc: string|null;
  pnl_usd_net: number|null; close_reason: string|null; notes: string|null;
  images_count: number|null; ea: string|null; session: string|null; timeframe: string|null;
};
function fmtLocal(s?:string|null){ if(!s) return ""; return new Date(s).toLocaleString("es-MX",{hour12:true}); }
function duration(a?:string|null,b?:string|null){
  if(!a || !b) return "";
  const ms = new Date(b).getTime()-new Date(a).getTime();
  const sec = Math.floor(ms/1000), h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  const pad=(n:number)=>String(n).padStart(2,'0'); return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function badge(v:number|null){ const win = (v??0) >= 0; return <span style={{padding:"2px 8px", borderRadius:6, background: win?"#e6f4ea":"#fde7e9", color: win?"#137333":"#b3261e", fontWeight:700}}>{win?"WINNER":"LOSER"}</span>; }

// [BLOQUE 3] Fetch ------------------------------------------------------------
async function fetchTrade(id:number){
  const { data, error } = await supabaseAdmin
    .from("trades")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if(error) throw error;
  return data as Trade | null;
}

async function fetchImages(trade_id:number){
  const { data } = await supabaseAdmin
    .from("trade_images")
    .select("id,title,path,sort_index,byte_size,content_type")
    .eq("trade_id", trade_id)
    .order("sort_index",{ascending:true});
  return data ?? [];
}

// [BLOQUE 4] Página -----------------------------------------------------------
export default async function TradeDetail({ params }:{ params:{ id:string } }) {
  const id = Number(params.id);
  const trade = await fetchTrade(id);
  const images = await fetchImages(id);

  if(!trade) return <main style={{padding:24}}>No existe el trade.</main>;

  return (
    <main style={{padding:"24px", display:"grid", gap:"12px"}}>
      <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
        <h2 style={{margin:0}}>Trade #{trade.id} — {trade.symbol} ({trade.side})</h2>
        {badge(trade.pnl_usd_net)}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:"10px"}}>
        <div>
          <div><b>Apertura:</b> {fmtLocal(trade.dt_open_utc)}</div>
          <div><b>Cierre:</b> {fmtLocal(trade.dt_close_utc)}</div>
          <div><b>Duración:</b> {duration(trade.dt_open_utc, trade.dt_close_utc)}</div>
          <div><b>Precio entrada:</b> {trade.entry_price ?? "-"}</div>
          <div><b>Precio salida:</b> {trade.exit_price ?? "-"}</div>
        </div>
        <div>
          <div><b>$P&L neto:</b> {trade.pnl_usd_net ?? 0}</div>
          <div><b>Close reason:</b> {trade.close_reason ?? "-"}</div>
          <div><b>EA:</b> {trade.ea ?? "-"}</div>
          <div><b>Sesión:</b> {trade.session ?? "-"}</div>
          <div><b>Timeframe:</b> {trade.timeframe ?? "-"}</div>
        </div>
      </div>

      <div>
        <b>Notas:</b>
        <div style={{whiteSpace:"pre-wrap", border:"1px solid #eee", padding:"8px", borderRadius:6}}>{trade.notes ?? ""}</div>
      </div>

      <div>
        <b>Imágenes ({images.length}):</b>
        <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
          {images.map(img=>(
            <div key={img.id} style={{border:"1px solid #eee", padding:6, borderRadius:8}}>
              {/* Placeholder de preview (signed URL se generará en una iteración posterior) */}
              <div style={{fontSize:12, maxWidth:240}}>
                <div><b>{img.title ?? "sin título"}</b></div>
                <div>{img.path}</div>
              </div>
            </div>
          ))}
          {images.length===0 && <div>Sin imágenes.</div>}
        </div>
      </div>

      <div style={{display:"flex", gap:12}}>
        <Link href="/trades">← Volver</Link>
        <Link href={`/trades/${id}/edit`}>/edit (pendiente)</Link>
      </div>
    </main>
  );
}

