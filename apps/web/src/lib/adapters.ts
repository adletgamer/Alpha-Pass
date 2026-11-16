// Adaptadores a las herramientas del ecosistema.
// En modo "demo" todo es simulado y determinista; en modo "testnet" cada
// adaptador debe implementarse contra la API real (ver docs/INTEGRACIONES.md).
// No se inventan endpoints: los métodos testnet fallan con un mensaje claro
// hasta que se conecten con la documentación oficial de cada proveedor.

import type { AssetCode, Milestone, Parcel } from "./domain";
import { RECORDED_RISK } from "./sample-data";

export type AlphaMode = "demo" | "testnet";
export const MODE: AlphaMode =
  process.env.NEXT_PUBLIC_ALPHA_MODE === "testnet" ? "testnet" : "demo";

/** Evalúa riesgo de deforestación por parcela (Whisp, FAO). */
export interface DeforestationProvider {
  assess(parcels: Parcel[]): Promise<Record<string, "sin_riesgo" | "alerta">>;
}

/** Emite y ancla credenciales verificables (ACTA, did:stellar). */
export interface CredentialProvider {
  issue(kind: string, subject: unknown): Promise<{ id: string; hash: string }>;
}

/** Escrow por hitos (Trustless Work). */
export interface EscrowProvider {
  create(input: { lotId: string; asset: AssetCode; amount: number }): Promise<{ escrowId: string }>;
  fund(escrowId: string): Promise<void>;
  approveAndRelease(escrowId: string, milestone: Milestone): Promise<void>;
}

class NotConfiguredError extends Error {
  constructor(provider: string, docs: string) {
    super(`${provider} no está conectado todavía. Ver ${docs} y docs/INTEGRACIONES.md.`);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoDeforestation: DeforestationProvider = {
  async assess(parcels) {
    await wait(400);
    return Object.fromEntries(parcels.map((p) => [p.id, RECORDED_RISK[p.id] ?? "sin_riesgo"]));
  },
};

export const demoCredentials: CredentialProvider = {
  async issue(kind) {
    await wait(150);
    return { id: `urn:demo:${kind}:${Date.now()}`, hash: "" };
  },
};

export const demoEscrow: EscrowProvider = {
  async create({ lotId }) {
    await wait(300);
    return { escrowId: `demo-escrow-${lotId}` };
  },
  async fund() {
    await wait(300);
  },
  async approveAndRelease() {
    await wait(300);
  },
};

export const testnetDeforestation: DeforestationProvider = {
  async assess() {
    throw new NotConfiguredError("Whisp (FAO)", "https://whisp.openforis.org");
  },
};

export const testnetCredentials: CredentialProvider = {
  async issue() {
    throw new NotConfiguredError("ACTA", "https://acta.build");
  },
};

export const testnetEscrow: EscrowProvider = {
  async create() {
    throw new NotConfiguredError("Trustless Work", "https://docs.trustlesswork.com");
  },
  async fund() {
    throw new NotConfiguredError("Trustless Work", "https://docs.trustlesswork.com");
  },
  async approveAndRelease() {
    throw new NotConfiguredError("Trustless Work", "https://docs.trustlesswork.com");
  },
};

export const providers =
  MODE === "demo"
    ? { deforestation: demoDeforestation, credentials: demoCredentials, escrow: demoEscrow }
    : { deforestation: testnetDeforestation, credentials: testnetCredentials, escrow: testnetEscrow };

/** Emisores Testnet de los activos aceptados por el escrow. */
export const ASSETS: Record<AssetCode, { code: AssetCode; issuer: string; label: string }> = {
  USDC: {
    code: "USDC",
    issuer: process.env.NEXT_PUBLIC_USDC_ISSUER ?? "",
    label: "USDC · dólar digital (Circle)",
  },
  EURC: {
    code: "EURC",
    issuer: process.env.NEXT_PUBLIC_EURC_ISSUER ?? "",
    label: "EURC · euro digital bajo MiCA (Circle)",
  },
};
