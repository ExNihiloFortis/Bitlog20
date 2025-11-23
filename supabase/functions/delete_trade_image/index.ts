// supabase/functions/delete_trade_image/index.ts
// Borra una sola imagen: archivo (si tiene storage_path) + fila trade_images.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
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

    // Validar usuario con ANON + JWT
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
    const imageId = body?.image_id as number | undefined;

    if (!imageId || typeof imageId !== "number") {
      return new Response(JSON.stringify({ error: "Invalid image_id" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Cliente admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Leer la imagen y verificar que pertenece a un trade del usuario
    const { data: img, error: imgErr } = await supabaseAdmin
      .from("trade_images")
      .select("id, trade_id, storage_path, user_id")
      .eq("id", imageId)
      .maybeSingle();

    if (imgErr || !img) {
      console.error("imgErr", imgErr);
      return new Response(JSON.stringify({ error: "Imagen no encontrada" }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Si tienes user_id en trade_images:
    if (img.user_id && img.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 2) Borrar archivo físico si hay storage_path
    const path = img.storage_path as string | null;
    if (path && path.trim().length > 0) {
      const { error: storErr } = await supabaseAdmin
        .storage
        .from("journal")
        .remove([path]);

      if (storErr) {
        console.error("storErr", storErr);
        // No hacemos return; seguimos para borrar la fila, pero queda logueado.
      }
    }

    // 3) Borrar fila de trade_images
    const { error: delErr } = await supabaseAdmin
      .from("trade_images")
      .delete()
      .eq("id", imageId);

    if (delErr) {
      console.error("delErr", delErr);
      return new Response(JSON.stringify({ error: "Error borrando imagen" }), {
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

