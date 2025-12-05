// supabase/functions/import_csv/index.ts
// Bitlog — Importador CSV robusto (broker + Bitlog Charts)

// ===============================
// [BLOQUE 0] Imports y cliente
// ===============================
import { createClient } from "npm:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===============================
// [BLOQUE 1] Utilidades HTTP / CORS
// ===============================
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...(init || {}),
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

// ===============================
// [BLOQUE 2] Pequeñas utilidades
// ===============================
type CsvRow = Record<string, string>;

function asNum(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Detecta separador y parsea CSV sencillo (sin comillas complejas)
function parseCSV(text: string): CsvRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  let delimiter = ",";

  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount >= tabCount) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  }

  const headers = headerLine.split(delimiter).map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const parts = raw.split(delimiter);
    const row: CsvRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (parts[j] ?? "").trim();
    }
    rows.push(row);
  }

  return rows;
}

// ===============================
// [BLOQUE 3] Mapeo de columnas dinámicas
// ===============================
const TICKET_KEYS = ["ticket", "position_id", "trade_id"];
const OPEN_KEYS = ["dt_open_utc", "opening_time_utc", "open_time_utc"];
const CLOSE_KEYS = ["dt_close_utc", "closing_time_utc", "close_time_utc"];
const ENTRY_KEYS = ["entry_price", "opening_price", "open_price"];
const EXIT_KEYS = ["exit_price", "closing_price", "close_price"];

function pick(row: CsvRow, keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return undefined;
}

// ===============================
// [BLOQUE 4] Normalizadores
// ===============================
function normSide(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v.startsWith("B")) return "BUY";
  if (v.startsWith("S")) return "SELL";
  return null;
}

function normSession(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();

  if (v.includes("london")) return "London";
  if (v.includes("new york") || v === "ny" || v === "newyork") return "New York";
  if (v.includes("sydney")) return "Sydney";
  if (v.includes("tokyo") || v.includes("asia")) return "Tokyo";
  if (v.includes("after")) return "After-hours";

  return null;
}

function normCloseReason(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();

  if (v === "tp" || v === "take_profit" || v.includes("take profit")) return "TP";
  if (v === "sl" || v === "stop_loss" || v.includes("stop loss")) return "SL";
  if (v === "be" || v === "breakeven" || v === "break_even") return "BREAKEVEN";
  if (v === "time" || v.includes("timeout")) return "TIME";
  if (v === "user" || v === "manual" || v.includes("close by user")) return "MANUAL";

  // Cualquier otra cosa válida pero genérica
  return "OTHER";
}

// ===============================
// [BLOQUE 5] mapRow: CSV -> { raw, app, ticket0 }
// ===============================
function mapRow(row: CsvRow) {
  const ticket0 = (row.ticket || pick(row, TICKET_KEYS) || "").trim();

  const dtOpenRaw =
    row.dt_open_utc ||
    row.opening_time_utc ||
    row.open_time_utc ||
    undefined;

  const dtCloseRaw =
    row.dt_close_utc ||
    row.closing_time_utc ||
    row.close_time_utc ||
    undefined;

  const entry_price = asNum(row.entry_price || pick(row, ENTRY_KEYS));
  const exit_price = asNum(row.exit_price || pick(row, EXIT_KEYS));

  const side = normSide(row.side || row.type);

  const volume =
    asNum(row.volume || row.lots || row.original_position_size) ?? null;

  // PNL: priorizamos columnas ya calculadas por Bitlog; si no, usamos profit_usd del broker
  const pnl_net =
    asNum(row.pnl_usd_net) ??
    asNum(row.profit_usd) ??
    null;

  const fee_usd =
    asNum(row.fee_usd) ??
    asNum(row.commission_usd) ??
    null;

  const swap =
    asNum(row.swap) ??
    asNum(row.swap_usd) ??
    null;

  const pnl_gross =
    asNum(row.pnl_usd_gross) ??
    (pnl_net !== null && fee_usd !== null
      ? pnl_net + fee_usd + (swap ?? 0)
      : pnl_net);

  const close_reason_raw = row.close_reason || row.close_reason_raw || "";
  const close_reason = normCloseReason(close_reason_raw || undefined);

  const app: Record<string, any> = {
    // Identidad base
    ticket: ticket0 || null,
    symbol: (row.symbol || "").trim() || null,
    timeframe: (row.timeframe || "").trim() || null,
    session: normSession(row.session) ?? null,

    // Campos principales de trading
    side,
    volume,
    entry_price,
    exit_price,

    dt_open_utc: dtOpenRaw || null,
    dt_close_utc: dtCloseRaw || null,

    // Redundancia con las columnas legacy (por compatibilidad)
    opening_time_utc: dtOpenRaw || null,
    closing_time_utc: dtCloseRaw || null,

    pips: asNum(row.pips),
    rr_objetivo: row.rr_objetivo || null,

    // P&L
    pnl_usd_net: pnl_net,
    pnl_usd_gross: pnl_gross,
    fee_usd,
    swap,

    // EA / estrategia
    ea: row.ea || null,
    ea_signal: row.ea_signal || null,
    ea_score: asNum(row.ea_score),
    ea_tp1: row.ea_tp1 || null,
    ea_tp2: row.ea_tp2 || null,
    ea_tp3: row.ea_tp3 || null,
    ea_sl1: row.ea_sl1 || null,

    // PA avanzada
    patron: row.patron || null,
    vela: row.vela || null,
    tendencia: row.tendencia || null,
    emocion: row.emocion || null,
    notes: row.notes || row.notas || null,

    // Campos de riesgo / cuenta (si vienen)
    equity_usd: asNum(row.equity_usd),
    margin_level: asNum(row.margin_level),

    // Close reason
    close_reason,
    close_reason_raw: close_reason_raw || null,
  };

  const raw: Record<string, any> = { ...row };

  return { raw, app, ticket0 };
}

// ===============================
// [BLOQUE 6] Handler HTTP principal
// ===============================
Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return json(
        { code: 405, message: "Method not allowed" },
        { status: 405 },
      );
    }

    // Auth: Bearer token del usuario
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(
        { code: 401, message: "Missing Bearer token" },
        { status: 401 },
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const { data: userData, error: authError } = await supabase.auth.getUser(
      token,
    );
    if (authError || !userData?.user) {
      return json(
        { code: 401, message: "Invalid user" },
        { status: 401 },
      );
    }
    const user_id = userData.user.id;

    // Cuerpo: aceptamos multipart/form-data o texto plano
    const contentType = req.headers.get("content-type") ?? "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return json(
          { code: 400, message: "Missing 'file' field in form-data" },
          { status: 400 },
        );
      }
      csvText = await file.text();
    } else {
      csvText = await req.text();
    }

    const rows = parseCSV(csvText);
    if (!rows.length) {
      return json(
        { code: 400, message: "CSV vacío o sin filas válidas" },
        { status: 400 },
      );
    }

    const trades: any[] = [];
    const tickets: string[] = [];

    for (const row of rows) {
      const { app, ticket0 } = mapRow(row);
      if (!ticket0) continue;

      trades.push({ ...app, user_id });
      tickets.push(ticket0);
    }

    if (!trades.length) {
      return json(
        { code: 400, message: "No se encontraron filas con 'ticket' válido" },
        { status: 400 },
      );
    }

    // Detectar cuáles ya existen para separar inserted / merged (solo para métricas)
    const uniqueTickets = Array.from(new Set(tickets));
    const { data: existing, error: existError } = await supabase
      .from("trades")
      .select("ticket")
      .eq("user_id", user_id)
      .in("ticket", uniqueTickets);

    if (existError) {
      console.error("Error consultando tickets existentes", existError);
    }

    const existingSet = new Set(
      (existing ?? []).map((r: any) => String(r.ticket)),
    );
    let inserted = 0;
    let merged = 0;

    for (const t of trades) {
      if (existingSet.has(String(t.ticket))) merged++;
      else inserted++;
    }

    // Upsert definitivo
    const { error: upsertError } = await supabase
      .from("trades")
      .upsert(trades, { onConflict: "user_id,ticket" });

    if (upsertError) {
      console.error("Error en upsert de trades", upsertError);
      return json(
        { code: 500, message: "Error al guardar trades", detail: upsertError.message },
        { status: 500 },
      );
    }

    return json({
      code: 200,
      message: "Importación completada",
      rows: rows.length,
      inserted,
      merged,
    });
  } catch (err) {
    console.error("Error inesperado en import_csv", err);
    return json(
      { code: 500, message: "Unexpected error", detail: String(err) },
      { status: 500 },
    );
  }
});

