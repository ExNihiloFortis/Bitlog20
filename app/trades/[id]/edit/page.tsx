// ===================== [E1] app/trades/[id]/edit/page.tsx =====================
// Página de edición de trade
// - Carga el trade desde Supabase por ID
// - Usa el formulario global <TradeForm /> para editar campos principales
// - Mantiene ImageManager independiente para las imágenes
// ==============================================================================

"use client";

// ===================== [E2] Imports =====================
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";
import TradeForm from "@/app/trades/_components/TradeForm"; // Formulario global


// ===================== [E3] Tipo Trade (de la tabla trades) =====================
type Trade = {
  id: number;
  user_id: string;
  ticket: string | null;

  symbol: string | null;
  timeframe: string | null;
  ea: string | null;
  patron: string | null;   // pattern
  vela: string | null;     // candle

  side: "BUY" | "SELL" | null;
  session: string | null;
  tendencia: string | null;
  emocion: string | null;

  entry_price: number | null;
  exit_price: number | null;
  volume: number | null;
  pnl_usd_gross: number | null;

  pips: number | null;
  rr_objetivo: string | null;

  ea_signal: "BUY" | "SELL" | null;
  ea_tp1: string | null;
  ea_tp2: string | null;
  ea_tp3: string | null;
  ea_sl1: string | null;
  ea_score: number | null;

  opening_time_utc: string | null;
  closing_time_utc: string | null;
  close_reason: string | null;

  notes: string | null;
};


// ===================== [E4] Componente principal =====================
export default function TradeEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [uid, setUid] = useState<string>("");
  const [f, setF] = useState<Trade | null>(null);
  const [saving, setSaving] = useState(false);

  // ID Bitlog para mostrar en el encabezado
  const bitlogId = useMemo(() => f?.id ?? Number(params.id), [f, params.id]);

  // ---------- [E4.1] Cargar usuario y trade desde Supabase ----------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUid(auth.user.id);

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("id", Number(params.id))
        .maybeSingle();

      if (error) {
        alert("Error cargando trade: " + error.message);
        return;
      }

      setF(data as Trade);
    })();
  }, [params.id, router]);

  // ---------- [E4.2] Handler de guardado (update) ----------
  async function handleFormSubmit(values: any) {
    if (!f) return;

    if (!values.ticket || values.ticket.trim() === "") {
      alert("Ticket es requerido");
      return;
    }

    setSaving(true);
    try {
      const toNumber = (v: string) =>
        v !== "" && v != null && !Number.isNaN(Number(v)) ? Number(v) : null;

      // Partimos del trade original y sobreescribimos solo los campos editables del formulario
          const payload: Partial<Trade> = {
      ...f,
      ticket: values.ticket || null,
      session: values.session || null,
      symbol: values.symbol || null,
      timeframe: values.timeframe || null,

      ea: values.ea || null,
      patron: values.patron || null,
      vela: values.vela || null,
      tendencia: values.tendencia || null,

      entry_price: toNumber(values.entry_price),
      exit_price: toNumber(values.exit_price),

      pips: toNumber(values.pips),
      rr_objetivo: values.rr_objetivo || null,
      pnl_usd_gross: toNumber(values.pnl_usd_gross),
      volume: toNumber(values.volume),

      emocion: values.emocion || null,
      side: values.side || null,

      close_reason: values.close_reason || null,

      ea_signal: values.ea_signal || null,
      ea_tp1: values.ea_tp1 || null,
      ea_tp2: values.ea_tp2 || null,
      ea_tp3: values.ea_tp3 || null,
      ea_sl1: values.ea_sl1 || null,
      ea_score: toNumber(values.ea_score),

      notes: values.notas || null,
    };

    // Normalizar valores raros antiguos
    if (payload.close_reason === "User") {
      payload.close_reason = "OTHER";
    }


      // Normalizar close_reason incompatible (por si viene "User" de imports viejos)
      if (payload.close_reason === "User") {
        payload.close_reason = "OTHER";
      }

      const { error } = await supabase
        .from("trades")
        .update(payload)
        .eq("id", f.id);

      if (error) throw error;

      router.push(`/trades/${f.id}`);
    } catch (err: any) {
      alert("Error al guardar: " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  // ---------- [E4.3] Estado de carga ----------
  if (!f) {
    return (
      <div className="container">
        <div id="topnav-placeholder"></div>
        <div className="card">
          <p>Cargando…</p>
        </div>
      </div>
    );
  }
  
  // ---------- [E4.4] initialValues para TradeForm ----------
const initialValues = {
  ticket: f.ticket ?? "",
  session: (f.session as any) ?? "",
  symbol: f.symbol ?? "",
  timeframe: f.timeframe ?? "",

  ea: f.ea ?? "",
  patron: f.patron ?? "",
  vela: f.vela ?? "",
  tendencia: f.tendencia ?? "",

  entry_price: f.entry_price != null ? String(f.entry_price) : "",
  exit_price: f.exit_price != null ? String(f.exit_price) : "",

  pips: f.pips != null ? String(f.pips) : "",
  rr_objetivo: f.rr_objetivo ?? "",
  pnl_usd_gross: f.pnl_usd_gross != null ? String(f.pnl_usd_gross) : "",
  volume: f.volume != null ? String(f.volume) : "",

  emocion: f.emocion ?? "",
  side: f.side ?? "",

  close_reason: f.close_reason ?? "",

  ea_signal: f.ea_signal ?? "",
  ea_tp1: f.ea_tp1 ?? "",
  ea_tp2: f.ea_tp2 ?? "",
  ea_tp3: f.ea_tp3 ?? "",
  ea_sl1: f.ea_sl1 ?? "",
  ea_score: f.ea_score != null ? String(f.ea_score) : "",

  notas: f.notes ?? "",
};

  // ===================== [E5] Render =====================
  return (
    <div className="container">
      <div id="topnav-placeholder"></div>

      <div className="card">
        {/* [E5.1] Encabezado con título y botón Cancelar */}
        <div
          className="head-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div>
            <h1 className="title">
              Editar Trade #{f.ticket ?? f.id} /{" "}
              <span style={{ opacity: 0.8 }}>Bitlog ID: #{bitlogId}</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn secondary" href={`/trades/${f.id}`}>
              Cancelar
            </a>
          </div>
        </div>

        {/* [E5.2] Formulario global */}
        <TradeForm
          mode="edit"
          initialValues={initialValues}
          saving={saving}
          onSubmit={handleFormSubmit}
        />

        {/* [E5.3] ImageManager (misma ubicación lógica que antes: parte baja de la tarjeta) */}
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Imágenes</label>
          <ImageManager tradeId={f.id} userId={uid} />
        </div>
      </div>
    </div>
  );
}

