// ===================== [N1] app/trades/new/page.tsx =====================
// NUEVO TRADE usando TradeForm global + galería activa
// - Usa TradeForm (mismo layout 3 columnas que /trades/[id]/edit)
// - Mantiene lógica probada de creación de trade + subida de imágenes
// - Inserta en public.trades y luego crea registros en trade_images
// - Wrapper visual igual que /trades/[id]/edit: container + card
// ========================================================================

"use client";

// ===================== [N2] Imports y tipos =====================
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageManager from "@/components/ImageManager";
import TradeForm from "@/app/trades/_components/TradeForm";

// ===================== [N3] Whitelist de columnas =====================
// Solo enviamos columnas conocidas para no romper si la tabla cambia.
const TRADE_COLS = new Set<string>([
  "user_id",
  "ticket",
  "session",
  "symbol",
  "timeframe",
  "ea",
  "patron",
  "vela",
  "tendencia",
  "pips",
  "rr_objetivo",
  "rr_objective",
  "pnl_usd_gross",
  "notes",
  "notas",
  "emocion",
  "side",
  "ea_signal",
  "ea_tp1",
  "ea_tp2",
  "ea_tp3",
  "ea_sl1",
  "ea_score",
  "volume",
  "entry_price",
  "exit_price",
  "close_reason",
]);

// ===================== [N4] Tipo de valores del formulario =====================
type TradeFormValues = {
  ticket: string;
  session?: string | null;
  symbol?: string | null;
  timeframe?: string | null;
  ea?: string | null;
  patron?: string | null;
  vela?: string | null;
  tendencia?: string | null;
  entry_price?: string | number | null;
  exit_price?: string | number | null;
  pips?: string | number | null;
  rr_objetivo?: string | null;
  rr_objective?: string | null;
  pnl_usd_gross?: string | number | null;
  volume?: string | number | null;
  emocion?: string | null;
  side?: "" | "BUY" | "SELL" | null;
  close_reason?: "" | "TP" | "SL" | "BREAKEVEN" | "TIME" | "OTHER" | null;
  ea_signal?: "BUY" | "SELL";
  ea_tp1?: string | null;
  ea_tp2?: string | null;
  ea_tp3?: string | null;
  ea_sl1?: string | null;
  ea_score?: string | number | null;
  notas?: string | null;
};

// ===================== [N5] Valores iniciales =====================
const INITIAL_VALUES: TradeFormValues = {
  ticket: "",
  session: "London",
  symbol: "",
  timeframe: "",
  ea: "",
  patron: "",
  vela: "",
  tendencia: "",
  entry_price: "",
  exit_price: "",
  pips: "",
  rr_objetivo: "",
  rr_objective: "",
  pnl_usd_gross: "",
  volume: "",
  emocion: "",
  side: "",
  close_reason: "",
  ea_signal: "BUY",
  ea_tp1: "",
  ea_tp2: "",
  ea_tp3: "",
  ea_sl1: "",
  ea_score: "",
  notas: "",
};

// ===================== [N6] Página Nuevo Trade =====================
export default function TradeNewPage() {
  // Estado de usuario y guardado
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Colas de imágenes (NEW)
  const [queuedBlobs, setQueuedBlobs] = useState<Blob[]>([]);
  const [queuedUrls, setQueuedUrls] = useState<string[]>([]);

  // ===================== [N6.1] Carga de usuario =====================
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? "";
      if (!uid) {
        window.location.href = "/login";
        return;
      }
      setUserId(uid);
      setLoading(false);
    })();
  }, []);

  // ===================== [N7] Build de payload =====================
  function buildPayload(values: TradeFormValues): Record<string, any> {
    const p: Record<string, any> = {};

    // user_id + ticket siempre
    p["user_id"] = userId || null;
    p["ticket"] = (values.ticket ?? "").trim();

    const put = (col: string, val: any) => {
      if (!TRADE_COLS.has(col)) return;
      if (val === "" || typeof val === "undefined") {
        p[col] = null;
      } else {
        p[col] = val;
      }
    };

    // Helper numérico
    const toNum = (v: any) =>
      v === "" || v === null || typeof v === "undefined" || Number.isNaN(Number(v))
        ? null
        : Number(v);

    // Campos directos
    put("session", values.session ?? null);
    put("symbol", values.symbol ?? null);
    put("timeframe", values.timeframe ?? null);
    put("ea", values.ea ?? null);
    put("patron", values.patron ?? null);
    put("vela", values.vela ?? null);
    put("tendencia", values.tendencia ?? null);

    // Numéricos
    put("entry_price", toNum(values.entry_price));
    put("exit_price", toNum(values.exit_price));
    put("pips", toNum(values.pips));
    put("pnl_usd_gross", toNum(values.pnl_usd_gross));
    put("volume", toNum(values.volume));

    // RR objetivo
    if (values.rr_objetivo) put("rr_objetivo", values.rr_objetivo);
    else if (values.rr_objective) put("rr_objective", values.rr_objective);

    // Notas (notes/notas según exista)
    if (TRADE_COLS.has("notes")) {
      put("notes", values.notas ?? null);
    } else if (TRADE_COLS.has("notas")) {
      put("notas", values.notas ?? null);
    }

    // Emoción y lado
    put("emocion", values.emocion ?? null);
    put("side", values.side ?? null);

    // Close reason
    put("close_reason", values.close_reason ?? null);

    // Bloque EA
    put("ea_signal", values.ea_signal ?? null);
    put("ea_tp1", values.ea_tp1 ?? null);
    put("ea_tp2", values.ea_tp2 ?? null);
    put("ea_tp3", values.ea_tp3 ?? null);
    put("ea_sl1", values.ea_sl1 ?? null);
    if (
      typeof values.ea_score !== "undefined" &&
      values.ea_score !== "" &&
      values.ea_score !== null
    ) {
      put("ea_score", toNum(values.ea_score));
    }

    return p;
  }

  // ===================== [N8] Submit handler =====================
  async function handleSubmit(values: TradeFormValues) {
    if (!values.ticket || values.ticket.trim() === "") {
      alert("Ticket es obligatorio.");
      return;
    }
    if (!userId) {
      alert("Inicia sesión primero.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(values);

      const { data, error } = await supabase
        .from("trades")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      const tradeId = data?.id as number;

      // Subir colas (blobs y urls) igual que antes
      for (const blob of queuedBlobs) {
        const ext = (blob.type.split("/")[1] || "png").toLowerCase();
        const key = `u_${userId}/t_${tradeId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("journal").upload(key, blob, {
          upsert: false,
          contentType: blob.type || "image/png",
        });
        if (!up.error) {
          await supabase.from("trade_images").insert({
            user_id: userId,
            trade_id: tradeId,
            title: "pasted",
            storage_path: key,
          });
        }
      }

      for (const url of queuedUrls) {
        await supabase.from("trade_images").insert({
          user_id: userId,
          trade_id: tradeId,
          title: "url",
          external_url: url,
        });
      }

      window.location.href = `/trades/${tradeId}`;
    } catch (err: any) {
      alert("Error al crear el trade: " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  // ===================== [N9] UI =====================
  if (loading) {
    return (
      <div className="container">
        <div id="topnav-placeholder"></div>
        <div className="card">
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div id="topnav-placeholder"></div>

      <div className="card">
        {/* Header (mismo estilo que edit) */}
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
            <h1 className="title">Nuevo Trade</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn secondary" href="/trades">
              Cancelar
            </a>
          </div>
        </div>

        {/* Formulario global */}
        <TradeForm
          mode="create"
          initialValues={INITIAL_VALUES}
          saving={saving}
          onSubmit={handleSubmit}
        />

        {/* Galería (activa en NEW: cola blobs+urls) */}
        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Imágenes</label>
          <ImageManager
            tradeId={null}
            userId={userId}
            onQueueChange={setQueuedBlobs}
            onQueuedUrlsChange={setQueuedUrls}
          />
        </div>
      </div>
    </div>
  );
}

