// lib/useCatalogOptions.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

type Kind =
  | "symbol"
  | "timeframe"
  | "patron"
  | "vela"
  | "ea"
  | "emotion"
  | "session";

type CatalogItem = {
  id: number;
  kind: Kind;
  value: string;
  sort_index: number;
};

export function useCatalogOptions(userId?: string) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [timeframes, setTimeframes] = useState<string[]>([]);
  const [patrones, setPatrones] = useState<string[]>([]);
  const [velas, setVelas] = useState<string[]>([]);
  const [eas, setEas] = useState<string[]>([]);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);

  const reloadAll = useCallback(async () => {
    // Nota: traemos catálogo global (user_id IS NULL) + del usuario (si existe)
    const { data, error } = await supabase
      .from("catalog_items")
      .select("kind,value,sort_index")
      .in("kind", [
        "symbol",
        "timeframe",
        "patron",
        "vela",
        "ea",
        "emotion",
        "session",
      ])
      .or(`user_id.is.null, user_id.eq.${userId ?? "00000000-0000-0000-0000-000000000000"}`)
      .order("sort_index", { ascending: true })
      .order("value", { ascending: true });

    if (error) {
      console.warn("useCatalogOptions error:", error.message);
      return;
    }
    const vals = (k: Kind) =>
      (data || [])
        .filter((r) => r.kind === k)
        .map((r) => r.value)
        .filter((v) => v && v.trim().length > 0);

    setSymbols(vals("symbol"));
    setTimeframes(vals("timeframe"));
    setPatrones(vals("patron"));
    setVelas(vals("vela"));
    setEas(vals("ea"));
    setEmotions(vals("emotion"));
    setSessions(vals("session"));
  }, [userId]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  return {
    symbols,
    timeframes,
    patrones,
    velas,
    eas,
    emotions,
    sessions,
    reloadAll,
  };
}

