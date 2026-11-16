import { describe, expect, it } from "vitest";
import { canRelease, milestoneAmount, releasedAmount, splitPremium } from "./release-gate";
import { initialLot } from "./sample-data";
import { merkleRoot, canonicalJson } from "./merkle";
import type { Lot } from "./domain";

function fundedLot(): Lot {
  return {
    ...initialLot(),
    passportRoot: "abc",
    escrow: { asset: "USDC", amount: 16500, funded: true, released: { acopio: false, embarque: false, llegada: false } },
  };
}

describe("canRelease", () => {
  it("bloquea si el escrow no tiene fondos", () => {
    expect(canRelease(initialLot(), "acopio")).toEqual({ ok: false, reason: "escrow_no_fondeado" });
  });

  it("bloquea el embarque sin credencial aunque el acopio esté liberado", () => {
    const lot = fundedLot();
    lot.attestations.push({ milestone: "acopio", issuer: "almacen", evidenceHash: "h", timestamp: "t" });
    lot.escrow!.released.acopio = true;
    expect(canRelease(lot, "embarque")).toEqual({ ok: false, reason: "falta_atestacion" });
  });

  it("bloquea saltarse un hito", () => {
    const lot = fundedLot();
    lot.attestations.push({ milestone: "embarque", issuer: "agente", evidenceHash: "h", timestamp: "t" });
    expect(canRelease(lot, "embarque")).toEqual({ ok: false, reason: "hito_anterior_pendiente" });
  });

  it("permite liberar con credencial y en orden", () => {
    const lot = fundedLot();
    lot.attestations.push({ milestone: "acopio", issuer: "almacen", evidenceHash: "h", timestamp: "t" });
    expect(canRelease(lot, "acopio")).toEqual({ ok: true });
  });

  it("funciona igual con EURC", () => {
    const lot = fundedLot();
    lot.escrow!.asset = "EURC";
    lot.attestations.push({ milestone: "acopio", issuer: "almacen", evidenceHash: "h", timestamp: "t" });
    expect(canRelease(lot, "acopio").ok).toBe(true);
  });
});

describe("montos", () => {
  it("reparte 30/50/20 y suma el total", () => {
    expect(milestoneAmount(16500, "acopio")).toBe(4950);
    expect(milestoneAmount(16500, "embarque")).toBe(8250);
    expect(milestoneAmount(16500, "llegada")).toBe(3300);
    expect(milestoneAmount(1000.01, "acopio") + milestoneAmount(1000.01, "embarque") + milestoneAmount(1000.01, "llegada")).toBeCloseTo(1000.01, 2);
  });

  it("suma solo lo liberado", () => {
    const lot = fundedLot();
    lot.escrow!.released.acopio = true;
    expect(releasedAmount(lot)).toBe(4950);
  });

  it("reparte el premio por sacos y el resto va al último", () => {
    const shares = splitPremium(1000, [14, 12, 19]);
    expect(shares).toEqual([311.11, 266.66, 422.23]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
  });
});

describe("merkle", () => {
  it("es determinista sin importar el orden de las claves", async () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    const r1 = await merkleRoot([{ a: 1 }, { b: 2 }, { c: 3 }]);
    const r2 = await merkleRoot([{ a: 1 }, { b: 2 }, { c: 3 }]);
    expect(r1).toBe(r2);
    expect(r1).toMatch(/^[0-9a-f]{64}$/);
  });
});
