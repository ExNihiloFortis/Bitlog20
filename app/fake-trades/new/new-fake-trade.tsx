"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/components/TopNav";
import FakeTradeForm, { FakeTradeFormValues } from "@/app/fake-trades/_components/FakeTradeForm";
import FakeTradeImageManager from "@/components/FakeTradeImageManager";

const INITIAL_VALUES: Partial<FakeTradeFormValues> = {
  source_type: "EXTERNA",
  result: "PENDING",
};

function toNum(v: any) {
  return v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v);
}

function localToIso(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildPayload(values: FakeTradeFormValues, userId?: string) {
  return {
    ...(userId ? { user_id: userId } : {}),
    symbol: values.symbol.trim().toUpperCase(),
    side: values.side || null,
    timeframe: values.timeframe || null,
    setup_datetime: localToIso(values.setup_datetime),
    target_date: localToIso(values.target_date),
    source_type: values.source_type || "EXTERNA",
    source_name: values.source_name || null,
    source_url: values.source_url || null,
    pattern_name: values.pattern_name || null,
    candle_name: values.candle_name || null,
    ea: values.ea || null,
    entry_price: toNum(values.entry_price),
    stop_loss: toNum(values.stop_loss),
    take_profit: toNum(values.tp1),
    tp1: toNum(values.tp1),
    tp2: toNum(values.tp2),
    resistance: toNum(values.resistance),
    pivot: toNum(values.pivot),
    support: toNum(values.support),
    tendencia: values.tendencia || null,
    session: values.session || null,
    rsi_value: toNum(values.rsi_value),
    stochastic_k: toNum(values.stochastic_k),
    stochastic_d: toNum(values.stochastic_d),
    ema20: toNum(values.ema20),
    ema50: toNum(values.ema50),
    ema100: toNum(values.ema100),
    ema200: toNum(values.ema200),
    atr: toNum(values.atr),
    adx: toNum(values.adx),
    rvol: toNum(values.rvol),
    expected_move: values.expected_move || null,
    failure_reason: values.failure_reason || null,
    lessons_learned: values.lessons_learned || null,
    result: values.result || "PENDING",
    notes: values.notes || null,
  };
}

export default function NewFakeTradePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [queuedBlobs, setQueuedBlobs] = useState<Blob[]>([]);
  const [queuedUrls, setQueuedUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? "";
      if (!uid) {
        router.push("/login");
        return;
      }
      setUserId(uid);
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(values: FakeTradeFormValues) {
    if (!values.symbol.trim()) {
      alert("Símbolo es obligatorio.");
      return;
    }
    if (!userId) return;

    setSaving(true);
    try {
      const payload = buildPayload(values, userId);

      const { data, error } = await supabase
        .from("fake_trades")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      const fakeTradeId = data.id as number;

      for (const blob of queuedBlobs) {
        const ext = (blob.type.split("/")[1] || "png").toLowerCase();
        const key = `u_${userId}/ft_${fakeTradeId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("journal").upload(key, blob, {
          upsert: false,
          contentType: blob.type || "image/png",
        });
        if (!up.error) {
          await supabase.from("fake_trade_images").insert({
            user_id: userId,
            fake_trade_id: fakeTradeId,
            title: "image",
            storage_path: key,
          });
        }
      }

      for (const url of queuedUrls) {
        await supabase.from("fake_trade_images").insert({
          user_id: userId,
          fake_trade_id: fakeTradeId,
          title: "url",
          external_url: url,
        });
      }

      router.push(`/fake-trades/${fakeTradeId}`);
    } catch (err: any) {
      alert("Error al crear fake trade: " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <><TopNav /><div className="container"><div className="card"><p>Cargando…</p></div></div></>;
  }

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card">
          <div className="head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h1 className="title">Nuevo Fake Trade</h1>
            <a className="btn secondary" href="/fake-trades">Cancelar</a>
          </div>

          <FakeTradeForm mode="create" initialValues={INITIAL_VALUES} saving={saving} onSubmit={handleSubmit} />

          <div className="field" style={{ marginTop: 16 }}>
            <label className="label">Captura del patrón / imágenes</label>
            <FakeTradeImageManager fakeTradeId={null} userId={userId} onQueueChange={setQueuedBlobs} onQueuedUrlsChange={setQueuedUrls} />
          </div>
        </div>
      </div>
    </>
  );
}
