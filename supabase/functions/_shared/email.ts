// supabase/functions/_shared/email.ts
// ==========================================================
// Envío de correos usando Resend vía HTTP (compatible con Deno)
// Usa:
//  - RESEND_API_KEY  (Edge Function Secret)
//  - MAIL_FROM       (Edge Function Secret)
// ==========================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "BitLog <no-reply@resend.dev>";

if (!RESEND_API_KEY) {
  console.warn("[email] RESEND_API_KEY no está definido. No se podrán enviar correos.");
}

export async function sendOTPEmail(to: string, code: string) {
  if (!RESEND_API_KEY) {
    console.error("[email] Falta RESEND_API_KEY. Abortando sendOTPEmail.");
    return;
  }

  const payload = {
    from: MAIL_FROM,
    to: [to],
    subject: "Tu código de verificación (BitLog 2FA)",
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222;">
        <p>Hola,</p>
        <p>Tu código de verificación para <strong>BitLog</strong> es:</p>
        <p style="font-size: 24px; letter-spacing: 6px; font-weight: bold; margin: 12px 0;">
          ${code}
        </p>
        <p style="font-size: 13px; color: #555;">
          El código expira en 10 minutos. Si tú no solicitaste este código, puedes ignorar este correo.
        </p>
      </div>
    `,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[email] Error Resend:", res.status, txt);
    } else {
      console.log("[email] OTP enviado a", to);
    }
  } catch (err) {
    console.error("[email] Excepción enviando OTP:", err);
  }
}

