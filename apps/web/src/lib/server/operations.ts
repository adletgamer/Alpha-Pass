import "server-only";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { MILESTONES, type Lot } from "../domain";
import { initialLot } from "../sample-data";
import type { SharedOperation, OperationRole, OperationProgress } from "../operation";
import { readEscrowMilestones, readLotOnChain, readTransaction } from "./stellar";
import { identifyRole, OperationError } from "./operation-state";
import { readOperation, type OperationRow } from "./operations-db";

export async function authorizedOperation(id: string, key: string | null) {
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new OperationError("Abre un enlace de acceso al lote.", 403);
  const row = await readOperation(id);
  const role = row && identifyRole(row.access_hashes, key);
  if (!row || !role) throw new OperationError("El enlace no da acceso a este lote.", 403);
  return { row, role };
}

export async function transactionState(hash?: string, expires?: number) {
  if (!hash) return { state: "replaceable" as const };
  const tx = await readTransaction(hash);
  if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    const value: unknown = tx.returnValue ? scValToNative(tx.returnValue) : undefined;
    return { state: "confirmed" as const, value };
  }
  if (tx.status === rpc.Api.GetTransactionStatus.FAILED || (expires && Date.now() / 1000 > expires + 60)) {
    return { state: "replaceable" as const };
  }
  return { state: "pending" as const };
}

export async function operationView(row: OperationRow, role: OperationRole): Promise<SharedOperation> {
  const lot = initialLot(row.lot_id);
  const progress: OperationProgress = structuredClone(row.state);
  const candidate = progress.escrow;
  const [chain, deploy, fund, anchor] = await Promise.all([
    progress.credential || progress.anchorHash || candidate ? readLotOnChain(lot.id) : null,
    candidate?.contractId ? null : transactionState(candidate?.deployHash, candidate?.deployExpires),
    transactionState(candidate?.fundHash, candidate?.fundExpires),
    transactionState(progress.anchorHash, progress.anchorExpires),
  ]);
  lot.parcels = lot.parcels.map((parcel) => ({ ...parcel, risk: progress.risks?.[parcel.id] ?? parcel.risk }));
  if (chain) {
    if (chain.cooperative !== row.cooperative || (progress.credential && chain.passportRoot !== progress.credential.root)) {
      throw new OperationError("El pasaporte en Stellar no coincide con la operación.");
    }
    lot.passportRoot = chain.passportRoot;
    lot.attestations = chain.attestations.map((a) => ({ ...a, timestamp: new Date(a.timestamp * 1000).toISOString() }));
  }
  if (candidate && !candidate.contractId && deploy?.state === "confirmed" && typeof deploy.value === "string" && /^C[A-Z2-7]{55}$/.test(deploy.value)) {
    candidate.contractId = deploy.value;
  }
  if (candidate?.contractId) {
    const flags = await readEscrowMilestones(candidate.contractId, lot.id);
    const released = Object.fromEntries(MILESTONES.map((milestone, index) => [milestone, flags[index].released])) as NonNullable<Lot["escrow"]>["released"];
    lot.escrow = {
      contractId: candidate.contractId,
      asset: candidate.asset,
      amount: candidate.amount,
      funded: Boolean(candidate.fundConfirmed) || fund.state === "confirmed" || flags.some((flag) => flag.released),
      released,
    };
  }
  if (candidate && fund.state === "confirmed") candidate.fundConfirmed = true;
  return {
    lot,
    role,
    cooperative: row.cooperative,
    progress,
    pendingAnchor: !chain && anchor.state !== "replaceable",
    pendingDeploy: Boolean(candidate && !candidate.contractId && deploy?.state !== "replaceable"),
    pendingFund: fund.state === "pending" && !candidate?.fundConfirmed,
  };
}
