// supabase/functions/delete_trade/index.ts
// Borra un trade completo + sus imágenes físicas en el bucket (cuando tienen storage_path).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // si quieres, luego lo limitamos a tu dominio
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();

    if (!jwt) {
      return new Response(JSON.stringify({ error: "No JWT" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Cliente "user" para validar que el JWT es válido
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userRes?.user) {
      console.error("userErr", userErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    const user = userRes.user;

    const body = await req.json().catch(() => null);
    const tradeId = body?.trade_id as number | undefined;

    if (!tradeId || typeof tradeId !== "number") {
      return new Response(JSON.stringify({ error: "Invalid trade_id" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Cliente admin con service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Verificar que el trade pertenece al usuario
    const { data: trade, error: tradeErr } = await supabaseAdmin
      .from("trades")
      .select("id, user_id")
      .eq("id", tradeId)
      .maybeSingle();

    if (tradeErr || !trade) {
      console.error("tradeErr", tradeErr);
      return new Response(JSON.stringify({ error: "Trade no encontrado" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (trade.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 2) Obtener imágenes ligadas a ese trade
    const { data: images, error: imgErr } = await supabaseAdmin
      .from("trade_images")
      .select("id, storage_path")
      .eq("trade_id", tradeId);

    if (imgErr) {
      console.error("imgErr", imgErr);
      return new Response(JSON.stringify({ error: "Error leyendo imágenes" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 3) Borrar archivos físicos solo cuando storage_path es un string válido
    const pathsToDelete = (images ?? [])
      .map((img) => img.storage_path as string | null)
      .filter(
        (p): p is string =>
          typeof p === "string" && p.trim().length > 0
      );

    if (pathsToDelete.length > 0) {
      const { error: storErr } = await supabaseAdmin.storage
        .from("journal")
        .remove(pathsToDelete);

      if (storErr) {
        console.error("storErr", storErr);
        // No hacemos return aquí para no dejar el trade colgado;
        // pero lo registramos en logs.
      }
    }

    // 4) Borrar filas de trade_images
    const { error: delImgsErr } = await supabaseAdmin
      .from("trade_images")
      .delete()
      .eq("trade_id", tradeId);

    if (delImgsErr) {
      console.error("delImgsErr", delImgsErr);
      return new Response(JSON.stringify({ error: "Error borrando imágenes" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 5) Borrar el trade
    const { error: delTradeErr } = await supabaseAdmin
      .from("trades")
      .delete()
      .eq("id", tradeId);

    if (delTradeErr) {
      console.error("delTradeErr", delTradeErr);
      return new Response(JSON.stringify({ error: "Error borrando trade" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

