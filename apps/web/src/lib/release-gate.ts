// Regla central de Alpha Pass: un hito del escrow solo se libera si existe su
// atestación y si los hitos anteriores ya se liberaron.
// En testnet esta misma regla se verifica contra LotPassport.is_attested
// antes de aprobar el hito en Trustless Work.

import { MILESTONES, MILESTONE_SHARE, type Lot, type Milestone } from "./domain";

export type GateResult =
  | { ok: true }
  | { ok: false; reason: GateReason };

export type GateReason =
  | "escrow_no_fondeado"
  | "pasaporte_incompleto"
  | "falta_atestacion"
  | "hito_anterior_pendiente"
  | "ya_liberado";

export const GATE_MESSAGE: Record<GateReason, string> = {
  escrow_no_fondeado: "El escrow todavía no tiene fondos.",
  pasaporte_incompleto: "El lote no tiene su pasaporte anclado.",
  falta_atestacion: "Falta la credencial firmada de este hito.",
  hito_anterior_pendiente: "Primero debe liberarse el hito anterior.",
  ya_liberado: "Este hito ya fue liberado.",
};

export function canRelease(lot: Lot, milestone: Milestone): GateResult {
  const escrow = lot.escrow;
  if (!escrow?.funded) return { ok: false, reason: "escrow_no_fondeado" };
  if (!lot.passportRoot) return { ok: false, reason: "pasaporte_incompleto" };
  if (escrow.released[milestone]) return { ok: false, reason: "ya_liberado" };
  const idx = MILESTONES.indexOf(milestone);
  if (idx > 0 && !escrow.released[MILESTONES[idx - 1]]) {
    return { ok: false, reason: "hito_anterior_pendiente" };
  }
  if (!lot.attestations.some((a) => a.milestone === milestone)) {
    return { ok: false, reason: "falta_atestacion" };
  }
  return { ok: true };
}

/** Monto que libera un hito. El último hito absorbe el redondeo. */
export function milestoneAmount(total: number, milestone: Milestone): number {
  if (milestone === "llegada") {
    return round2(
      total - milestoneAmount(total, "acopio") - milestoneAmount(total, "embarque"),
    );
  }
  return round2((total * MILESTONE_SHARE[milestone]) / 100);
}

export function releasedAmount(lot: Lot): number {
  if (!lot.escrow) return 0;
  return round2(
    MILESTONES.filter((m) => lot.escrow!.released[m]).reduce(
      (sum, m) => sum + milestoneAmount(lot.escrow!.amount, m),
      0,
    ),
  );
}

/** Reparto del premio por sacos aportados; el resto va al último productor. */
export function splitPremium(amount: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => Math.floor((amount * w * 100) / total) / 100);
  const sent = shares.slice(0, -1).reduce((a, b) => a + b, 0);
  shares[shares.length - 1] = round2(amount - sent);
  return shares;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
