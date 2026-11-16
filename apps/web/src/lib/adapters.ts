// Adaptadores a las herramientas del ecosistema.
// demo:    simulados y deterministas (sin red).
// testnet: Whisp y Trustless Work vía rutas del servidor (claves en el servidor),
//          ACTA con su SDK vía proxy, LotPassport firmado por la wallet del usuario.

import type { AssetCode, Lot, Milestone, Parcel } from "./domain";
import { RECORDED_RISK } from "./sample-data";

export type AlphaMode = "demo" | "testnet";
export const MODE: AlphaMode =
  process.env.NEXT_PUBLIC_ALPHA_MODE === "testnet" ? "testnet" : "demo";

export interface Providers {
  deforestation: { assess(parcels: Parcel[]): Promise<Record<string, "sin_riesgo" | "alerta">> };
  passport: {
    anchor(lot: Lot, root: string, eligible: Parcel[]): Promise<{ note: string }>;
    attest(lotId: string, milestone: Milestone, evidenceHashHex: string): Promise<{ note: string }>;
  };
  escrow: {
    createAndFund(input: { lotId: string; asset: AssetCode; amount: number }): Promise<{ contractId: string }>;
    release(input: { contractId: string; lotId: string; milestone: Milestone }): Promise<{ note: string }>;
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoProviders: Providers = {
  deforestation: {
    async assess(parcels) {
      await wait(400);
      return Object.fromEntries(parcels.map((p) => [p.id, RECORDED_RISK[p.id] ?? "sin_riesgo"]));
    },
  },
  passport: {
    async anchor() {
      await wait(300);
      return { note: "demo" };
    },
    async attest() {
      await wait(200);
      return { note: "demo" };
    },
  },
  escrow: {
    async createAndFund({ lotId }) {
      await wait(400);
      return { contractId: `demo-escrow-${lotId}` };
    },
    async release() {
      await wait(300);
      return { note: "demo" };
    },
  },
};

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? json.detail ?? json.title ?? `Error ${res.status} en ${path}`);
  return json as T;
}

const testnetProviders: Providers = {
  deforestation: {
    async assess(parcels) {
      const { risks } = await api<{ risks: Record<string, "sin_riesgo" | "alerta"> }>("/api/whisp", {
        parcels: parcels.map((p) => ({ id: p.id, geometry: p.geometry })),
      });
      return risks;
    },
  },
  passport: {
    async anchor(lot, root, eligible) {
      const { getActaBridge } = await import("./acta-bridge");
      const { createLotOnChain } = await import("./lot-passport-client");
      const vc = await getActaBridge().issuePassport({
        lotId: lot.id,
        cooperative: lot.cooperative,
        passportRoot: root,
        parcels: eligible.map((p) => ({ id: p.id, bags: p.bags, risk: p.risk })),
        verifiedWith: "Whisp (FAO)",
      });
      const bags = eligible.reduce((s, p) => s + p.bags, 0);
      const tx = await createLotOnChain(lot.id, root, eligible.length, bags);
      return { note: `credencial ACTA ${vc.vcId} (${vc.issuerDid}) · LotPassport tx ${tx.slice(0, 10)}…` };
    },
    async attest(lotId, milestone, evidenceHashHex) {
      const { attestOnChain } = await import("./lot-passport-client");
      const tx = await attestOnChain(lotId, milestone, evidenceHashHex);
      return { note: `LotPassport tx ${tx.slice(0, 10)}…` };
    },
  },
  escrow: {
    async createAndFund({ lotId, asset, amount }) {
      const { currentAddress, signXdr } = await import("./wallet");
      const signer = await currentAddress();
      const deploy = await api<{ unsignedXdr: string; contractId?: string }>("/api/escrow", {
        action: "deploy", signer, lotId, asset, amount, receiver: signer,
      });
      const deployed = await api<{ contractId?: string }>("/api/escrow", {
        action: "submit", signedXdr: await signXdr(deploy.unsignedXdr),
      });
      const contractId = deployed.contractId ?? deploy.contractId;
      if (!contractId) throw new Error("Trustless Work no devolvió el contrato del escrow.");
      const fund = await api<{ unsignedXdr: string }>("/api/escrow", { action: "fund", contractId, signer, amount });
      await api("/api/escrow", { action: "submit", signedXdr: await signXdr(fund.unsignedXdr) });
      return { contractId };
    },
    async release(input) {
      const r = await api<{ releaseTx: string }>("/api/escrow/release", input);
      return { note: `liberación tx ${r.releaseTx.slice(0, 10)}…` };
    },
  },
};

export const providers: Providers = MODE === "demo" ? demoProviders : testnetProviders;

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
