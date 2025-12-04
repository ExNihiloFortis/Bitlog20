// ===============================
// [BLOQUE 0] Versión
// ===============================
const FN_VERSION = "import_csv v3.1-close-reason-raw";

// ===============================
// [BLOQUE 1] Imports
// ===============================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse as parseCsv } from "https://deno.land/std@0.224.0/csv/parse.ts";

// ===============================
// [BLOQUE C1] CORS + helper JSON
// ===============================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v as string));
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

// ===============================
// [BLOQUE 2] Supabase server client
// ===============================
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
// [BLOQUE 3] Utils CSV (parse robusto)
// ===============================
const sanitize = (t: string) =>
  t.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

function detectSeparator(headerLine: string): string {
  const c = (ch: string) => (headerLine.match(new RegExp(`\\${ch}`, "g")) || []).length;
  const counts: Record<string, number> = { ",": c(","), ";": c(";"), "\t": c("\t") };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSV(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const clean = sanitize(text);
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], headers: [] };

  const firstLine = lines[0];
  const sep = detectSeparator(firstLine);

  // Intento 1: std/csv con columns:true
  try {
    const parsed = parseCsv(clean, { columns: true, skipFirstRow: false, separator: sep }) as any[];
    const norm = parsed.map((r) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r ?? {})) {
        const key = String(k).trim().toLowerCase().replace(/\s+/g, "_");
        o[key] = v == null ? "" : String(v).trim();
      }
      return o;
    });
    const headers = Object.keys(norm[0] ?? {});
    if (norm.length > 0 && headers.length > 0) return { rows: norm, headers };
  } catch {
    // cae al fallback
  }

  // Intento 2: fallback manual (respeta comillas)
  const headers = firstLine.split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const out: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const cells: string[] = [];
    let cur = "", inQ = false, quoteChar = "";

    for (let j = 0; j < row.length; j++) {
      const ch = row[j];
      if ((ch === '"' || ch === "'")) {
        if (!inQ) { inQ = true; quoteChar = ch; continue; }
        if (inQ && ch === quoteChar) { inQ = false; quoteChar = ""; continue; }
      }
      if (ch === sep && !inQ) { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur.trim());

    // igualar longitudes
    const vals = [...cells];
    if (vals.length < headers.length) while (vals.length < headers.length) vals.push("");
    if (vals.length > headers.length) vals.length = headers.length;

    const o: Record<string, string> = {};
    headers.forEach((k, idx) => (o[k] = vals[idx] ?? ""));
    out.push(o);
  }

  return { rows: out, headers };
}

// ===============================
// [BLOQUE 4] Helpers mapeo
// ===============================
const TICKET_KEYS = ["ticket", "ticket_id", "order", "order_id", "id", "trade", "trade_id"];
const OPEN_KEYS   = ["opening_time_utc", "dt_open_utc", "open_time_utc", "open_time"];
const CLOSE_KEYS  = ["closing_time_utc", "dt_close_utc", "close_time_utc", "close_time"];
const ENTRY_KEYS  = ["entry_price", "price_open", "open", "entry", "opening_price"];
const EXIT_KEYS   = ["exit_price", "price_close", "close", "exit", "closing_price"];

const pick = (row: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (row[k] && row[k] !== "") return row[k];
  return "";
};
const asNum = (v?: string) => (v && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
const toDate = (v?: string) => {
  if (!v) return null;
  const raw = v.trim();
  // soporta "YYYY-MM-DD HH:MM[:SS]"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const isoGuess = raw.replace(" ", "T") + "Z";
    const d = new Date(isoGuess);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// ===============================
// [BLOQUE 4.1] Normalizador close_reason
// ===============================
// No forzamos "OTHER". Si no matchea, devolvemos null y luego caemos al valor crudo.
function normCloseReason(v?: string | null): string | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;

  // TP / SL
  if (["tp", "take_profit", "take profit", "take-profit", "profit", "target"].includes(s)) return "TP";
  if (["sl", "stop_loss", "stop loss", "stop-loss", "stopout", "stop out", "stopped"].includes(s)) return "SL";

  // Manual / Breakeven / Time
  if (["manual", "closed manual", "manual_close", "close manual", "close"].includes(s)) return "MANUAL";
  if (["be", "breakeven", "break-even", "break even"].includes(s)) return "BREAKEVEN";
  if (["time", "timeout", "timed", "session end", "end session"].includes(s)) return "TIME";

  // Si no reconocemos, devolvemos null para caer al valor crudo (raw)
  return null;
}

// ===============================
// [BLOQUE 5] Map CSV row -> { raw, app }
// ===============================

// ===============================
// [BLOQUE 5] Map CSV row -> { raw, app }
// ===============================
function mapRow(row: Record<string, string>) {
  const ticket0     = row.ticket || pick(row, TICKET_KEYS);
  const openingRaw  = row.opening_time_utc || pick(row, OPEN_KEYS);
  const closingRaw  = row.closing_time_utc || pick(row, CLOSE_KEYS);
  const entry_price = asNum(row.entry_price || pick(row, ENTRY_KEYS) || undefined);
  const exit_price  = asNum(row.exit_price  || pick(row, EXIT_KEYS)  || undefined);

  const typeRaw = (row.type || row.side || "").toUpperCase();
  const side = typeRaw.includes("BUY") ? "BUY" : typeRaw.includes("SELL") ? "SELL" : null;

  const lots   = asNum(row.lots || row.original_position_size || row.volume || undefined);
  const symbol = row.symbol || row.instrument || row.ticker || "";

  // Close reason: preserva crudo + normalizado (sin forzar OTHER)
  const close_reason_raw =
    row.close_reason_raw ||
    row.close_reason      ||
    row.comment           ||
    row.reason            ||
    null;

  let close_reason = normCloseReason(close_reason_raw);

  // 🔹 Profit estandarizado (usamos siempre el NETO como rey)
  const profit = asNum(
    row.profit_usd ??
    row.pnl_usd_net ??
    row.pnl_usd_gross ??
    undefined
  );

  // Si no viene close_reason pero sí hay profit → inferimos TP/SL/OTHER
  if (!close_reason && profit !== null) {
    if (profit > 0) close_reason = "TP";
    else if (profit < 0) close_reason = "SL";
    else close_reason = "OTHER";
  }

  return {
    raw: {
      ...row,
      ticket: ticket0,
      symbol,
      side,
      lots,
      entry_price,
      exit_price,
      opening_time_utc: openingRaw,
      closing_time_utc: closingRaw,
      close_reason_raw,
    },
    trade: {
      // Identidad básica
      user_id: row.user_id || null,
      ticket: ticket0,
      symbol,
      side,
      volume: lots,

      // Precios y tiempos
      entry_price,
      exit_price,
      dt_open_utc: openingRaw ? new Date(openingRaw).toISOString() : null,
      dt_close_utc: closingRaw ? new Date(closingRaw).toISOString() : null,

      // Meta / contexto
      timeframe: row.timeframe || null,
      session: row.session || null,
      ea: row.ea || null,

      // 🔹 PIPS y R
      pips: row.pips ? asNum(row.pips) : null,
      rr_objetivo: row.rr_objetivo || null,

      // 🔹 PNL (usamos profit como neto, y lo copiamos a gross para compatibilidad)
      pnl_usd_gross: profit,
      pnl_usd_net: profit,

      // 🔹 Costos
      fee_usd: asNum(row.fee_usd || row.commission_usd || undefined),
      swap_usd: asNum(row.swap_usd || undefined),
      swap: asNum(row.swap || row.swap_usd || undefined),
      equity_usd: asNum(row.equity_usd || undefined),
      margin_level: asNum(row.margin_level || undefined),

      // 🔹 EA y confluencias
      ea_signal: row.ea_signal || null,
      ea_score: row.ea_score ? Number(row.ea_score) : null,
      ea_tp1: row.ea_tp1 || null,
      ea_tp2: row.ea_tp2 || null,
      ea_tp3: row.ea_tp3 || null,
      ea_sl1: row.ea_sl1 || null,

      patron: row.patron || null,
      vela: row.vela || null,
      tendencia: row.tendencia || null,
      emocion: row.emocion || null,

      // 🔹 Estado y cierre
      rr: null, // (si en el futuro lo calculamos, se rellena aquí)
      status: closingRaw ? "CLOSED" : "OPEN",
      close_reason_raw,
      close_reason,

      // 🔹 Notas / tags
      notes: row.notes || row.notas || null,
      tags: row.tags ? row.tags.split("|") : null,
    },
  };
}

// ===============================
// [BLOQUE 6] Handler HTTP
// ===============================
Deno.serve(async (req) => {
  try {
    // Preflight OPTIONS
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }

    // Auth guard
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ code: 401, message: "Missing Bearer token" }, { status: 401 });
    const token = auth.slice("Bearer ".length).trim();
    const { data: user } = await supabase.auth.getUser(token);
    if (!user?.user) return json({ code: 401, message: "Invalid user" }, { status: 401 });
    const user_id = user.user.id;

    // form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return json({ ok: false, message: "Missing file" }, { status: 400 });

    // parse CSV
    const text = await file.text();
    const { rows, headers } = parseCSV(text);
    if (!rows.length) {
      const rawLines = sanitize(text).split("\n");
      return json(
        {
          ok: false,
          version: FN_VERSION,
          error: "CSV vacío o sin headers",
          headers,
          debug: { text_len: text.length, first_line: rawLines[0] ?? null, second_line: rawLines[1] ?? null },
        },
        { status: 400 },
      );
    }

    // Inserción / upsert
    let inserted = 0, merged = 0, skipped_no_symbol = 0;
    const errors: string[] = [];

    for (const r of rows) {
      const { raw, app, ticket0 } = mapRow(r);

      // símbolo requerido
      const symbol0 = app.symbol ?? "";
      if (!symbol0) { skipped_no_symbol++; continue; }

      // ticket determinista si falta
      let ticketFinal = ticket0;
      if (!ticketFinal || ticketFinal === "") {
        const s = `${symbol0}|${app.dt_open_utc ?? ""}|${app.entry_price ?? ""}`;
        const enc = new TextEncoder().encode(s);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        ticketFinal = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
      }
      (raw as any).ticket = ticketFinal;
      (app as any).ticket = ticketFinal;

      // trades_raw (upsert por user_id + ticket)
      const { error: e1 } = await supabase
        .from("trades_raw")
        .upsert({ user_id, ...raw }, { onConflict: "user_id,ticket" });
      if (e1) { errors.push(`raw:${e1.message}`); continue; }

      // trades (upsert manual)
      const { data: ex, error: eS } = await supabase
        .from("trades")
        .select("id")
        .eq("user_id", user_id)
        .eq("ticket", ticketFinal)
        .maybeSingle();
      if (eS) { errors.push(`sel:${eS.message}`); continue; }

      if (ex?.id) {
        const { error: e2 } = await supabase
          .from("trades")
          .update({ ...app })
          .eq("id", ex.id)
          .eq("user_id", user_id);
        if (e2) errors.push(`upd:${e2.message}`); else merged++;
      } else {
        const { error: e3 } = await supabase
          .from("trades")
          .insert([{ user_id, ...app }]);
        if (e3) errors.push(`ins:${e3.message}`); else inserted++;
      }
    }

    // conteo final (diagnóstico)
    const { count, error: eCount } = await supabase
      .from("trades")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", user_id);
    if (eCount) errors.push(`cnt:${eCount.message}`);

    return json({
      ok: true,
      version: FN_VERSION,
      headers,
      rows: rows.length,
      inserted,
      merged,
      skipped_no_symbol,
      errors: errors.slice(0, 10),
      trades_count_for_user: count ?? null,
    });
  } catch (e) {
    return json({ ok: false, version: FN_VERSION, error: String(e) }, { status: 500 });
  }
});

