// Adaptadores a las herramientas del ecosistema.
// Whisp y Trustless Work vía rutas del servidor, ACTA por proxy y LotPassport
// firmado por la wallet del usuario en Stellar Testnet.

import type { AssetCode, EscrowState, Lot, Milestone, Parcel } from "./domain";

export type AlphaMode = "demo" | "testnet";
export const MODE: AlphaMode =
  process.env.NEXT_PUBLIC_ALPHA_MODE === "testnet" &&
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") === "testnet" ? "testnet" : "demo";

export interface Providers {
  deforestation: { assess(parcels: Parcel[]): Promise<Record<string, "sin_riesgo" | "alerta">> };
  passport: {
    anchor(lot: Lot, root: string, eligible: Parcel[]): Promise<{ note: string }>;
    attest(lotId: string, milestone: Milestone, evidenceHashHex: string): Promise<{ note: string; txHash?: string }>;
  };
  escrow: {
    createAndFund(input: {
      lotId: string;
      asset: AssetCode;
      amount: number;
      expectedBuyer?: string;
      savedContractId?: string;
      pendingFund?: EscrowState["pendingFund"];
      onDeployed?: (contractId: string) => void;
      onFundSigned?: (contractId: string, pending: NonNullable<EscrowState["pendingFund"]>) => void;
    }): Promise<{ contractId: string }>;
    release(input: { contractId: string; lotId: string; milestone: Milestone; access?: string }): Promise<{ note: string }>;
  };
}

export async function api<T>(path: string, body: unknown, access?: string): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (access) headers.set("x-operation-access", access);
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? json.detail ?? json.title ?? `Error ${res.status} en ${path}`);
  return json as T;
}

export const providers: Providers = {
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
      return { note: `LotPassport tx ${tx.slice(0, 10)}…`, txHash: tx };
    },
  },
  escrow: {
    async createAndFund({ lotId, asset, amount, expectedBuyer, savedContractId, pendingFund, onDeployed, onFundSigned }) {
      const { currentAddress, NETWORK_PASSPHRASE, signXdr } = await import("./wallet");
      const signer = await currentAddress();
      if (expectedBuyer && signer !== expectedBuyer) throw new Error("Vuelve a conectar la cuenta del importador.");
      let contractId = savedContractId;
      if (contractId && pendingFund) {
        const { rpc } = await import("@stellar/stellar-sdk");
        const server = new rpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org");
        const receipt = await server.getTransaction(pendingFund.hash);
        if (receipt.status === rpc.Api.GetTransactionStatus.SUCCESS) return { contractId };
        if (receipt.status !== rpc.Api.GetTransactionStatus.FAILED &&
          (!pendingFund.expires || Date.now() / 1000 <= pendingFund.expires + 60)) {
          throw new Error("El fondeo anterior aún puede confirmarse. Espera un momento y vuelve a consultar con «Continuar fondeo».");
        }
      }
      if (!contractId) {
        const deploy = await api<{ unsignedXdr: string; contractId?: string }>("/api/escrow", {
          action: "deploy", signer, lotId, asset, amount,
        });
        const deployed = await api<{ contractId?: string }>("/api/escrow", {
          action: "submit", signedXdr: await signXdr(deploy.unsignedXdr, { expectedAddress: signer }),
        });
        contractId = deployed.contractId ?? deploy.contractId;
        if (!contractId) throw new Error("Trustless Work no devolvió el contrato del escrow.");
        onDeployed?.(contractId);
      }
      const fund = await api<{ unsignedXdr: string }>("/api/escrow", { action: "fund", contractId, signer, amount });
      const signedXdr = await signXdr(fund.unsignedXdr, { expectedAddress: signer });
      if (onFundSigned) {
        const { TransactionBuilder } = await import("@stellar/stellar-sdk");
        const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
        const hash = Array.from(tx.hash(), (byte) => byte.toString(16).padStart(2, "0")).join("");
        onFundSigned(contractId, { hash, expires: "timeBounds" in tx ? Number(tx.timeBounds?.maxTime ?? 0) : 0 });
      }
      await api("/api/escrow", { action: "submit", signedXdr });
      return { contractId };
    },
    async release({ access, ...input }) {
      const r = await api<{ releaseTx: string | null }>("/api/escrow/release", input, access);
      return { note: r.releaseTx ? `liberación tx ${r.releaseTx.slice(0, 10)}…` : "liberación confirmada en Stellar" };
    },
  },
};

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
