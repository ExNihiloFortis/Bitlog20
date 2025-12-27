// ===================== /lib/whatif.ts =====================
// [B1] Matemática What-If (NO BD, NO side-effects)
// ==========================================================

export type WhatIfInputs = {
  openPrice: number;
  closePriceReal: number;
  lotReal: number;
  pnlReal: number;
  closePriceHyp: number;
  lotHyp: number;
};

export function calcK(pnlReal: number, lotReal: number, openPrice: number, closePriceReal: number) {
  // k = pnl / (lot * (close-open))
  const delta = closePriceReal - openPrice;
  if (!isFinite(pnlReal)) throw new Error("P&L real inválido.");
  if (!isFinite(lotReal) || lotReal <= 0) throw new Error("Lotaje real inválido (debe ser > 0).");
  if (!isFinite(openPrice) || !isFinite(closePriceReal)) throw new Error("Precios reales inválidos.");
  if (delta === 0) throw new Error("Close - Open real = 0. No hay movimiento para calibrar.");
  return pnlReal / (lotReal * delta);
}

export function calcHypPnl(k: number, lotHyp: number, openPrice: number, closePriceHyp: number) {
  if (!isFinite(k)) throw new Error("k inválido.");
  if (!isFinite(lotHyp) || lotHyp <= 0) throw new Error("Lotaje hipotético inválido (debe ser > 0).");
  if (!isFinite(openPrice) || !isFinite(closePriceHyp)) throw new Error("Precios hipotéticos inválidos.");
  const deltaHyp = closePriceHyp - openPrice;
  return k * lotHyp * deltaHyp;
}

export function calcWhatIf(inputs: WhatIfInputs) {
  const k = calcK(inputs.pnlReal, inputs.lotReal, inputs.openPrice, inputs.closePriceReal);
  const pnlHyp = calcHypPnl(k, inputs.lotHyp, inputs.openPrice, inputs.closePriceHyp);
  return { k, pnlHyp };
}

