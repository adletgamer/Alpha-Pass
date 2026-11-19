import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { serverEnv } from "./env";
import type { AssetCode } from "../domain";

export type EscrowIntent = {
  lotId: string;
  action: "deploy" | "fund";
  signer: string;
  asset: AssetCode;
  amount: number;
  contractId?: string;
  hash: string;
  expires: number;
};

export function transactionIdentity(xdr: string) {
  const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  return { hash: Buffer.from(tx.hash()).toString("hex"), expires: "timeBounds" in tx ? Number(tx.timeBounds?.maxTime ?? 0) : 0 };
}

export function sealIntent(intent: EscrowIntent) {
  const fields = [intent.lotId, intent.action, intent.signer, intent.asset, intent.amount, intent.contractId ?? "", intent.hash, intent.expires];
  return createHmac("sha256", serverEnv.roles().approverSecret).update("alpha-pass:escrow:v1\0").update(JSON.stringify(fields)).digest("hex");
}

export function verifiedIntent(intent: EscrowIntent, ticket: unknown) {
  return typeof ticket === "string" && /^[0-9a-f]{64}$/.test(ticket) &&
    timingSafeEqual(Buffer.from(ticket, "hex"), Buffer.from(sealIntent(intent), "hex"));
}
