// ==============================================
// lib/schemas/tradeManual.ts
// ==============================================
import { z } from "zod";

export const SESSIONS = ["Sydney", "Tokyo", "London", "NewYork"] as const;
export const TIMEFRAMES = ["M1", "M5", "M15", "H1", "H4", "D1"] as const;

// Emociones: NO editable (listas positivas/negativas)
export const EMOTIONS = [
  // Positivas
  "Alegría","Calma","Confianza","Curiosidad","Excitación","Optimismo","Satisfacción",
  // Negativas
  "Aburrimiento","Ansiedad","Arrepentimiento","Duda","Fatiga","Frustración","Ira","Miedo",
] as const;

export const manualTradeSchema = z.object({
  ticket: z.string().trim().min(1, "El ticket es obligatorio"),

  // Combobox (editables): permiten texto libre, pero daremos sugerencias desde BD
  timeframe: z.string().trim().nullable().optional(),
  session: z.enum(SESSIONS).nullable().optional(),
  ea: z.string().trim().max(120).nullable().optional(),
  pattern: z.string().trim().max(120).nullable().optional(),
  trend: z.enum(["Alcista","Bajista","Lateral"]).nullable().optional(),
  candle: z.string().trim().max(120).nullable().optional(),
  symbol: z.string().trim().max(40).nullable().optional(),

  emotion: z.enum(EMOTIONS).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),

  // Métricas
  pips: z.coerce.number().finite().nullable().optional(),
  r_target: z.coerce.number().finite().nullable().optional(),
  pnl_usd_net: z.coerce.number().finite().nullable().optional(), // $P&L (neto)

  // Imágenes: guardamos solo URLs (evita storage pesado)
  image_urls: z.array(z.string().url()).max(50).nullable().optional(),
});

export type ManualTradeInput = z.infer<typeof manualTradeSchema>;

// Campos manuales (para UPDATE selectivo al existir ticket)
export const MANUAL_FIELDS: (keyof ManualTradeInput)[] = [
  "timeframe","session","ea","pattern","trend","candle","symbol",
  "emotion","notes","pips","r_target","pnl_usd_net","image_urls",
];

