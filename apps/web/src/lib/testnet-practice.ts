import { MILESTONES, type Lot } from "./domain";
import { initialLot } from "./sample-data";
import type { OnChainLot } from "./server/stellar";

export function importerPracticeLot(record: OnChainLot, id: string): Lot {
  if (record.lotId !== id || !/^[a-f0-9]{64}$/i.test(record.passportRoot) ||
    !/^G[A-Z2-7]{55}$/.test(record.cooperative) ||
    !Array.isArray(record.attestations) ||
    !MILESTONES.every((milestone) => record.attestations.some((proof) => proof.milestone === milestone))) {
    throw new Error("El lote de referencia todavía no tiene su pasaporte y los tres hitos confirmados en Stellar.");
  }
  return {
    ...initialLot(id),
    cooperative: record.cooperative,
    parcels: [],
    passportRoot: record.passportRoot,
    attestations: record.attestations.map((proof) => ({ ...proof, timestamp: new Date(proof.timestamp * 1000).toISOString() })),
  };
}
