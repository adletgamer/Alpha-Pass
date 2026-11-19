import "server-only";
import { Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { serverEnv } from "./env";

// Cliente mínimo de Trustless Work (escrow multi-release) para v1 y v2.
//   v1 (Testnet): https://dev.api.trustlesswork.com — claves del dApp de Testnet
//   v2 (beta):    https://beta.api.trustlesswork.com — claves del dApp v2
// La versión se deduce de la URL. La API nunca firma: cada endpoint devuelve un XDR
// sin firmar que firma la wallet del rol correspondiente.

export class TrustlessWorkError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Trustless Work respondió ${status}`);
  }
}

export async function tw<T = unknown>(path: string, body: unknown): Promise<T> {
  const { url, key } = serverEnv.trustlessWork();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new TrustlessWorkError(res.status, json);
  return json as T;
}

export interface UnsignedTx {
  unsignedXdr: string;
  txHash?: string;
  contractId?: string | null;
}

/** Cuerpo de despliegue en el formato v2 (el que arma buildEscrowDeploy). */
export interface DeployBody {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  platformFee: number;
  roles: {
    approvers: string[];
    serviceProviders: string[];
    releaseSigners: string[];
    disputeResolvers: string[];
    admin: string;
    platform: string;
  };
  milestones: { description: string; amount: number; receiver: string }[];
  trustline: { symbol: string; address: string };
}

const isV2 = () => serverEnv.trustlessWork().url.includes("beta.api");

function unsigned(res: { unsignedXdr?: string; unsignedTransaction?: string; contractId?: string | null }): UnsignedTx {
  const xdr = res.unsignedXdr ?? res.unsignedTransaction;
  if (!xdr) throw new TrustlessWorkError(502, { message: "Trustless Work no devolvió la transacción sin firmar." });
  return { unsignedXdr: xdr, contractId: res.contractId ?? null };
}

function hashOf(signedXdr: string) {
  const passphrase = serverEnv.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  return Buffer.from(TransactionBuilder.fromXDR(signedXdr, passphrase).hash()).toString("hex");
}

export const TW = {
  async deploy(body: DeployBody): Promise<UnsignedTx> {
    if (isV2()) return unsigned(await tw("/escrow/multi-release/v2/deploy", body));
    const { roles } = body;
    return unsigned(await tw("/deployer/multi-release", {
      signer: body.signer,
      engagementId: body.engagementId,
      title: body.title,
      description: body.description,
      platformFee: body.platformFee,
      roles: {
        approver: roles.approvers[0],
        serviceProvider: roles.serviceProviders[0],
        platformAddress: roles.platform,
        releaseSigner: roles.releaseSigners[0],
        disputeResolver: roles.disputeResolvers[0],
      },
      milestones: body.milestones,
      trustline: { address: body.trustline.address, symbol: body.trustline.symbol },
    }));
  },
  async fund(body: { contractId: string; signer: string; amount: number }): Promise<UnsignedTx> {
    return unsigned(await tw(isV2() ? "/escrow/multi-release/v2/fund" : "/escrow/multi-release/fund-escrow", body));
  },
  async approve(body: { contractId: string; approver: string; milestoneIndexes: number[] }): Promise<UnsignedTx> {
    if (isV2()) return unsigned(await tw("/escrow/multi-release/v2/approve-milestones", body));
    const [index] = body.milestoneIndexes;
    return unsigned(await tw("/escrow/multi-release/approve-milestone", {
      contractId: body.contractId, approver: body.approver, milestoneIndex: String(index),
    }));
  },
  async release(body: { contractId: string; releaseSigner: string; milestoneIndexes: number[] }): Promise<UnsignedTx> {
    if (isV2()) return unsigned(await tw("/escrow/multi-release/v2/release-funds", body));
    const [index] = body.milestoneIndexes;
    return unsigned(await tw("/escrow/multi-release/release-milestone-funds", {
      contractId: body.contractId, releaseSigner: body.releaseSigner, milestoneIndex: String(index),
    }));
  },
  async send(signedXdr: string): Promise<{ txHash: string; contractId?: string }> {
    const res = await tw<{ txHash?: string; hash?: string; contractId?: string; status?: string; message?: string }>(
      isV2() ? "/stellar/send-transaction" : "/helper/send-transaction",
      { signedXdr },
    );
    if (res.status && res.status !== "SUCCESS") throw new TrustlessWorkError(502, res);
    return { txHash: res.txHash ?? res.hash ?? hashOf(signedXdr), contractId: res.contractId };
  },
};
