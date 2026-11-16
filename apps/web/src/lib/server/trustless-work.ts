import "server-only";
import { serverEnv } from "./env";

// Cliente mínimo de la Core API v2 de Trustless Work (multi-release).
// Documentación: https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/introduction
// La API nunca firma: cada endpoint devuelve un XDR sin firmar que firma la wallet del rol.

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

export const TW = {
  deploy: (body: unknown) => tw<UnsignedTx>("/escrow/multi-release/v2/deploy", body),
  fund: (body: { contractId: string; signer: string; amount: number }) =>
    tw<UnsignedTx>("/escrow/multi-release/v2/fund", body),
  approve: (body: { contractId: string; approver: string; milestoneIndexes: number[] }) =>
    tw<UnsignedTx>("/escrow/multi-release/v2/approve-milestones", body),
  release: (body: { contractId: string; releaseSigner: string; milestoneIndexes: number[] }) =>
    tw<UnsignedTx>("/escrow/multi-release/v2/release-funds", body),
  send: (signedXdr: string) =>
    tw<{ txHash: string; ledger?: number; contractId?: string; code?: string }>("/stellar/send-transaction", { signedXdr }),
};
