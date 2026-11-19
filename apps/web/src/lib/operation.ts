import type { AssetCode, Lot, Milestone } from "./domain";

export const OPERATION_ROLES = ["cooperativa", "importador", "verificador"] as const;
export type OperationRole = typeof OPERATION_ROLES[number];
export type Risks = Record<string, "sin_riesgo" | "alerta">;

export interface EscrowProgress {
  asset: AssetCode;
  amount: number;
  buyer: string;
  contractId?: string;
  deployHash?: string;
  fundHash?: string;
  deployExpires?: number;
  fundExpires?: number;
  fundConfirmed?: boolean;
}

export interface OperationProgress {
  risks?: Risks;
  credential?: { id: string; root: string; txHash: string };
  anchorHash?: string;
  anchorExpires?: number;
  escrow?: EscrowProgress;
  attestationHashes?: Partial<Record<Milestone, string>>;
  approvalHashes?: Partial<Record<Milestone, string>>;
  releaseHashes?: Partial<Record<Milestone, string>>;
}

export interface SharedOperation {
  lot: Lot;
  cooperative: string;
  role: OperationRole;
  progress: OperationProgress;
  pendingAnchor: boolean;
  pendingDeploy: boolean;
  pendingFund: boolean;
}

export type Checkpoint =
  | { type: "risks"; risks: Risks }
  | { type: "credential"; credential: NonNullable<OperationProgress["credential"]> }
  | { type: "anchor"; hash: string; expires: number }
  | { type: "attested"; milestone: Milestone; hash: string }
  | { type: "deploy"; escrow: EscrowProgress; ticket?: string }
  | { type: "deployed"; contractId: string }
  | { type: "fund"; hash: string; expires: number; ticket?: string };

export function milestoneReceipts(progress: OperationProgress) {
  const { credential, anchorHash, escrow, attestationHashes, approvalHashes, releaseHashes } = progress;
  return [
    { label: "Credencial ACTA", hash: credential?.txHash },
    { label: "Anclaje del pasaporte", hash: anchorHash },
    { label: "Creación del escrow", hash: escrow?.deployHash },
    { label: "Fondeo del escrow", hash: escrow?.fundHash },
    ...Object.entries(attestationHashes ?? {}).map(([milestone, hash]) => ({ label: `Atestación de ${milestone}`, hash })),
    ...Object.entries(approvalHashes ?? {}).map(([milestone, hash]) => ({ label: `Aprobación de ${milestone}`, hash })),
    ...Object.entries(releaseHashes ?? {}).map(([milestone, hash]) => ({ label: `Liberación de ${milestone}`, hash })),
  ].filter(({ hash }) => hash);
}
