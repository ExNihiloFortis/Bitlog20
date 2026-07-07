"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/components/TopNav";
import FakeTradeForm, { FakeTradeFormValues } from "@/app/fake-trades/_components/FakeTradeForm";
import FakeTradeImageManager from "@/components/FakeTradeImageManager";

function toNum(v: any) {
  return v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v);
}
function isoToLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function EditFakeTradePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [row, setRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const id = useMemo(() => Number(params.id), [params.id]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUid(auth.user.id);
      const { data, error } = await supabase.from("fake_trades").select("*").eq("id", id).maybeSingle();
      if (error) alert("Error cargando fake trade: " + error.message);
      setRow(data);
    })();
  }, [id, router]);

  async function handleSubmit(values: FakeTradeFormValues) {
    if (!row) return;
    if (!values.symbol.trim()) {
      alert("Símbolo es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        symbol: values.symbol.trim().toUpperCase(),
        side: values.side || null,
        timeframe: values.timeframe || null,
        setup_datetime: localToIso(values.setup_datetime),
        source_type: values.source_type || "PROPIA",
        source_name: values.source_name || null,
        source_url: values.source_url || null,
        pattern_name: values.pattern_name || null,
        entry_price: toNum(values.entry_price),
        stop_loss: toNum(values.stop_loss),
        take_profit: toNum(values.take_profit),
        expected_move: values.expected_move || null,
        result: values.result || "PENDING",
        notes: values.notes || null,
      };
      const { error } = await supabase.from("fake_trades").update(payload).eq("id", row.id);
      if (error) throw error;
      router.push(`/fake-trades/${row.id}`);
    } catch (err: any) {
      alert("Error al guardar: " + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  }

  if (!row) return <><TopNav /><div className="container"><div className="card"><p>Cargando…</p></div></div></>;

  const initialValues: Partial<FakeTradeFormValues> = {
    symbol: row.symbol ?? "",
    side: row.side ?? "",
    timeframe: row.timeframe ?? "",
    setup_datetime: isoToLocalInput(row.setup_datetime),
    source_type: row.source_type ?? "PROPIA",
    source_name: row.source_name ?? "",
    source_url: row.source_url ?? "",
    pattern_name: row.pattern_name ?? "",
    entry_price: row.entry_price != null ? String(row.entry_price) : "",
    stop_loss: row.stop_loss != null ? String(row.stop_loss) : "",
    take_profit: row.take_profit != null ? String(row.take_profit) : "",
    expected_move: row.expected_move ?? "",
    result: row.result ?? "PENDING",
    notes: row.notes ?? "",
  };

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card">
          <div className="head-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h1 className="title">Editar Fake Trade #{row.id}</h1>
            <a className="btn secondary" href={`/fake-trades/${row.id}`}>Cancelar</a>
          </div>
          <FakeTradeForm mode="edit" initialValues={initialValues} saving={saving} onSubmit={handleSubmit} />
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label">Imágenes</label>
            <FakeTradeImageManager fakeTradeId={row.id} userId={uid} />
          </div>
        </div>
      </div>
    </>
  );
}
