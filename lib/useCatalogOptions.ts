// =============================================
// [useCatalogOptions.ts]  (BLOQUE 1) - Imports
// =============================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// TIPOS internos
type CatRow = {
  id: number;
  user_id: string | null;
  type: "symbol" | "timeframe" | "ea" | "pattern" | "candle";
  value: string;
  sort_index: number | null;
};

// ========================================================
// (BLOQUE 2) - util: uniq ordenado por sort_index, luego ABC
// ========================================================
function uniqSorted(rows: CatRow[], kind: CatRow["type"]): string[] {
  // Filtra por tipo
  const list = rows.filter(r => r.type === kind);
  // Ordena: sort_index (null al final), luego value asc
  list.sort((a, b) => {
    const ai = a.sort_index ?? 9_999_999;
    const bi = b.sort_index ?? 9_999_999;
    if (ai !== bi) return ai - bi;
    return a.value.localeCompare(b.value, undefined, { sensitivity:"base" });
  });
  // De-dup por value (último gana => user_id del user pisa global)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of list) {
    if (!seen.has(r.value)) {
      seen.add(r.value);
      out.push(r.value);
    }
  }
  return out;
}

// ======================================================================
// (BLOQUE 3) - HOOK PRINCIPAL: useCatalogOptions  *** DEFAULT EXPORT ***
// ======================================================================
export default function useCatalogOptions() {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<unknown>(null);
  const [rows,    setRows]    = useState<CatRow[]>([]);
  const [uid,     setUid]     = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Obtener user_id (para traer globales + del usuario)
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id ?? null;
        if (alive) setUid(userId);

        // 2) Traer catálogos globales (user_id IS NULL) y del usuario (si hay)
        //    Notas de esquema: usamos columnas: type (symbol/timeframe/ea/pattern/candle), value, sort_index
        //    Si tu tabla se llama distinto o las columnas difieren, ajusta aquí.
        const base = supabase
          .from("catalog_items")
          .select("id,user_id,type,value,sort_index")
          .in("type", ["symbol","timeframe","ea","pattern","candle"]);

        const { data, error } = userId
          ? await base.or(`user_id.is.null,user_id.eq.${userId}`)
          : await base.is("user_id", null);

        if (error) throw error;
        if (!data) {
          if (alive) { setRows([]); setLoading(false); }
          return;
        }

        // 3) Guardar
        if (alive) {
          // Forzamos tipos
          const casted = (data as any[]).map(r => ({
            id: r.id,
            user_id: r.user_id ?? null,
            type: r.type as CatRow["type"],
            value: String(r.value ?? "").trim(),
            sort_index: r.sort_index ?? null,
          })) as CatRow[];

          setRows(casted);
          setLoading(false);
        }
      } catch (err) {
        if (alive) { setError(err); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // 4) Derivados
  const symbols    = useMemo(() => uniqSorted(rows, "symbol"),    [rows]);
  const timeframes = useMemo(() => uniqSorted(rows, "timeframe"), [rows]);
  const eas        = useMemo(() => uniqSorted(rows, "ea"),        [rows]);
  const patterns   = useMemo(() => uniqSorted(rows, "pattern"),   [rows]);
  const candles    = useMemo(() => uniqSorted(rows, "candle"),    [rows]);

  return { symbols, timeframes, eas, patterns, candles, loading, error, userId: uid };
}

