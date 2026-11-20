import { describe, expect, it } from "vitest";
import { exampleLot } from "./example-lot";
import { buildLotEvidence, verifyLotEvidence, type EvidenceReference } from "./lot-evidence";

const lot = exampleLot();
const simulation = { type: "simulation" } as const;
const reference: EvidenceReference = { lotId: lot.id, root: lot.passportRoot!, source: simulation, parcels: 4 };

describe("expediente del lote", () => {
  it("conserva la raíz publicada para el ejemplo y excluye la parcela con alerta", async () => {
    const evidence = await buildLotEvidence(lot, simulation);
    expect(evidence).not.toBeNull();
    expect(evidence?.claims).toHaveLength(10);
    expect(JSON.stringify(evidence?.claims)).not.toContain("P-05");
    expect(evidence?.snapshot.milestones[0]).toMatchObject({ payment: "released", releaseTransaction: null });
    expect(await verifyLotEvidence(evidence, reference)).toBe("matches");
  });

  it("detecta una hoja modificada aunque se conserve la raíz del archivo", async () => {
    const original = (await buildLotEvidence(lot, simulation))!;
    const claims = original.claims.map((claim, index) => index === 1 ? { ...claim, producer: "Otro productor" } : claim);
    expect(await verifyLotEvidence({ ...original, claims }, reference)).toBe("different");
  });

  it("distingue el lote y el contrato y comprueba solamente el origen", async () => {
    const evidence = (await buildLotEvidence(lot, simulation))!;
    expect(await verifyLotEvidence(evidence, { ...reference, lotId: "otro" })).toBe("wrong_lot");
    expect(await verifyLotEvidence(evidence, { ...reference, source: { type: "stellar-testnet", contractId: "contrato" } })).toBe("wrong_source");
    expect(await verifyLotEvidence({ ...evidence, snapshot: null }, reference)).toBe("matches");
    expect(await verifyLotEvidence({}, reference)).toBe("invalid");
  });

  it("no exporta una raíz ausente o que no se puede reconstruir", async () => {
    expect(await buildLotEvidence({ ...lot, passportRoot: undefined }, simulation)).toBeNull();
    expect(await buildLotEvidence({ ...lot, passportRoot: "a".repeat(64) }, simulation)).toBeNull();
  });
});
