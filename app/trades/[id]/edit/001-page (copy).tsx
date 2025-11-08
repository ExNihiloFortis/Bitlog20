// ===================== [4] /trades/[id]/edit/page.tsx =====================
// [4.1] Editor minimal que respeta el layout general y NO rompe el esquema.
//  - Carga el trade por id y permite editar "Ticket" (seguro con tu DB actual).
//  - Deja el espacio listo para agregar el resto de campos cuando migremos columnas.
// ==========================================================================

"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import TopNav from "@/components/TopNav";

export default function TradeEdit({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [sb] = useState(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await sb.from("trades").select("ticket").eq("id", id).single();
        if (error) throw error;
        setTicket(data?.ticket ?? "");
      } catch (e: any) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, sb]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket.trim()) return alert("Ticket es obligatorio.");
    setSaving(true);
    try {
      const { error } = await sb.from("trades").update({ ticket }).eq("id", id);
      if (error) throw error;
      window.location.href = `/trades/${id}`;
    } catch (e: any) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopNav />
      <div className="container">
        <div className="card" style={{padding:16}}>
          <h2 className="title">Editar Trade #{id}</h2>
          {err && <div className="err">{err}</div>}
          {loading ? (
            <div>Cargando…</div>
          ) : (
            <form className="form-body" onSubmit={onSave}>
              <div className="grid-3">
                <div className="field">
                  <label className="label">Ticket *</label>
                  <input className="input" value={ticket} onChange={e=>setTicket(e.target.value)} />
                </div>
              </div>

              <div className="btn-row">
                <a href={`/trades/${id}`} className="btn secondary">Cancelar</a>
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

