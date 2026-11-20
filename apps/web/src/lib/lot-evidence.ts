import { MILESTONES, type Lot, type Milestone } from "./domain";
import { merkleRoot, passportClaims } from "./merkle";

const FORMAT = "alpha-pass.lot-evidence/v1";
export const MAX_EVIDENCE_BYTES = 256 * 1024;

export type EvidenceSource =
  | { type: "stellar-testnet"; contractId: string }
  | { type: "simulation" };

export interface EvidenceReference {
  lotId: string;
  source: EvidenceSource;
  root: string;
  parcels: number;
}

export async function buildLotEvidence(lot: Lot, source: EvidenceSource, releaseHashes?: Partial<Record<Milestone, string>>) {
  if (!lot.passportRoot) return null;
  const included = lot.parcels.filter((parcel) => parcel.risk === "sin_riesgo");
  if (included.length === 0) return null;
  const claims = passportClaims(lot, included);
  if ((await merkleRoot(claims)) !== lot.passportRoot) return null;
  return {
    format: FORMAT,
    lotId: lot.id,
    source,
    root: lot.passportRoot,
    claims,
    snapshot: {
      observedAt: new Date().toISOString(),
      escrow: lot.escrow ? { contractId: lot.escrow.contractId, asset: lot.escrow.asset } : null,
      milestones: MILESTONES.map((milestone) => {
        const released = lot.escrow?.released[milestone];
        return {
          milestone,
          attestation: lot.attestations.find((value) => value.milestone === milestone) ?? null,
          payment: released ? "released" : lot.escrow ? "pending" : "unavailable",
          releaseTransaction: released ? releaseHashes?.[milestone] ?? null : null,
        };
      }),
    },
  };
}

export type LotEvidence = NonNullable<Awaited<ReturnType<typeof buildLotEvidence>>>;
type Verification = "matches" | "wrong_lot" | "wrong_source" | "invalid" | "different";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Compara únicamente las hojas de origen con la raíz de referencia. */
export async function verifyLotEvidence(input: unknown, reference: EvidenceReference): Promise<Verification> {
  if (!isRecord(input) || input.format !== FORMAT || typeof input.lotId !== "string" ||
    !isRecord(input.source) || !Array.isArray(input.claims) || typeof input.root !== "string") return "invalid";
  if (input.lotId !== reference.lotId) return "wrong_lot";
  if (input.source.type !== reference.source.type ||
    (reference.source.type === "stellar-testnet" && input.source.contractId !== reference.source.contractId)) return "wrong_source";
  if (input.claims.length !== 2 + 2 * reference.parcels) return "different";
  const composition = input.claims.at(-1);
  if (!isRecord(composition) || composition.kind !== "composicion" || composition.lot !== reference.lotId) return "different";
  return input.root === reference.root && (await merkleRoot(input.claims)) === reference.root ? "matches" : "different";
}
