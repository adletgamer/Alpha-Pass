import type { Lot } from "./domain";
import { initialLot, RECORDED_RISK } from "./sample-data";

/**
 * Lote de ejemplo para la vista previa de la home: el mismo lote 2026-JAE-014
 * del prototipo, en el punto en que el acopio ya se liberó.
 * Datos ilustrativos. La raíz es la que calcula la app para estas credenciales
 * de ejemplo (ver store.anchorPassport).
 */
export function exampleLot(): Lot {
  const base = initialLot();
  return {
    ...base,
    parcels: base.parcels.map((p) => ({ ...p, risk: RECORDED_RISK[p.id] ?? "sin_riesgo" })),
    passportRoot: "42a439f1d61a4aac05b17e9b1b9b15271b91611f7df190339259f89b398017bb",
    attestations: [
      {
        milestone: "acopio",
        issuer: "Almacén de acopio (demo)",
        // SHA-256 de "Guía de recepción 0001-2345, 60 sacos" (evidencia de ejemplo)
        evidenceHash: "0fa88bad701a06a695e066753b399855f992e6ed8f3cea619afb7cadde36f5e0",
        timestamp: "2026-11-21T15:00:00.000Z",
      },
    ],
    escrow: {
      contractId: "demo-escrow-2026-JAE-014",
      asset: "USDC",
      amount: 16500,
      funded: true,
      released: { acopio: true, embarque: false, llegada: false },
    },
    premiumDistributed: false,
  };
}
