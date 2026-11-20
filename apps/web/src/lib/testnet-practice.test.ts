import { describe, expect, it } from "vitest";
import { MILESTONES } from "./domain";
import { importerPracticeLot } from "./testnet-practice";

const id = "2026-JAE-014-PRACTICE";
const address = `G${"A".repeat(55)}`;
const record = {
  lotId: id, cooperative: address, passportRoot: "a".repeat(64), parcels: 4, bags: 60, createdAt: 1795120000,
  attestations: MILESTONES.map((milestone) => ({ milestone, issuer: address, evidenceHash: "b".repeat(64), timestamp: 1795120000 })),
};

describe("práctica del importador", () => {
  it("usa las pruebas en cadena y empieza con un escrow propio pendiente", () => {
    const lot = importerPracticeLot(record, id);
    expect(lot).toMatchObject({ id, cooperative: address, passportRoot: record.passportRoot, parcels: [] });
    expect(lot.escrow).toBeUndefined();
    expect(lot.attestations.map(({ milestone }) => milestone)).toEqual(MILESTONES);
  });

  it("rechaza un lote distinto, una raíz inválida o atestaciones incompletas", () => {
    expect(() => importerPracticeLot(record, "otro")).toThrow("confirmados en Stellar");
    expect(() => importerPracticeLot({ ...record, passportRoot: "" }, id)).toThrow("confirmados en Stellar");
    expect(() => importerPracticeLot({ ...record, attestations: record.attestations.slice(0, 2) }, id)).toThrow("confirmados en Stellar");
  });
});
