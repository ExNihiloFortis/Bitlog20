// supabase/functions/request_otp/index.ts
// Genera un OTP de 6 dígitos para el usuario autenticado y lo guarda en user_otp.
// Ahora ENVÍA el código por email usando Resend y SOLO devuelve { ok: true }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOTPEmail } from "../_shared/email.ts";

// CORS headers
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // luego lo podemos limitar
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Preflight CORS
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

    // Cliente con ANON KEY y JWT en headers (para obtener usuario actual)
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      console.error("userError", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (!user.email) {
      console.error("[request_otp] Usuario sin email");
      return new Response(JSON.stringify({ error: "User has no email" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // Cliente con service role para escribir en user_otp
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutos

    const { error: insertError } = await supabaseAdmin
      .from("user_otp")
      .insert({
        user_id: user.id,
        code,
        expires_at: expires.toISOString(),
        used: false,
      });

    if (insertError) {
      console.error("insertError", insertError);
      return new Response(
        JSON.stringify({ error: "Error creando OTP" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Enviar correo REAL con el OTP (Resend)
    await sendOTPEmail(user.email, code);

    console.log("[request_otp] OTP generado y enviado a", user.email);

    // PRODUCCIÓN: NO devolvemos el código
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

