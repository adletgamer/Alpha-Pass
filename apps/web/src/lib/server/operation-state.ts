import { createHash, timingSafeEqual } from "node:crypto";
import { OPERATION_ROLES, type Checkpoint, type OperationProgress, type OperationRole } from "../operation";
import { SAMPLE_PARCELS } from "../sample-data";
import { MILESTONES } from "../domain";

export type AccessHashes = Record<OperationRole, string>;
const hashPattern = /^[a-f0-9]{64}$/i;
const walletPattern = /^G[A-Z2-7]{55}$/;
const contractPattern = /^C[A-Z2-7]{55}$/;

export function accessHash(key: string) {
  if (!hashPattern.test(key)) throw new Error("Código de acceso inválido.");
  return createHash("sha256").update(key).digest("hex");
}

export function identifyRole(hashes: AccessHashes, key: string) {
  const digest = Buffer.from(accessHash(key), "hex");
  return OPERATION_ROLES.find((role) => timingSafeEqual(digest, Buffer.from(hashes[role], "hex")));
}

export class OperationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function requireValid(value: unknown, message: string): asserts value {
  if (!value) throw new OperationError(message, 400);
}

export function applyCheckpoint(
  state: OperationProgress,
  role: OperationRole,
  checkpoint: Checkpoint,
  canReplace: (hash: string | undefined, expires: number | undefined) => boolean,
): OperationProgress {
  if (!checkpoint || !["risks", "credential", "anchor", "attested", "deploy", "deployed", "fund"].includes(checkpoint.type)) {
    throw new OperationError("Paso desconocido.", 400);
  }
  const ownerStep = ["risks", "credential", "anchor"].includes(checkpoint.type);
  if (role !== (ownerStep ? "cooperativa" : checkpoint.type === "attested" ? "verificador" : "importador")) {
    throw new OperationError("Este enlace no permite registrar ese paso.", 403);
  }
  switch (checkpoint.type) {
    case "risks": {
      requireValid(!state.credential && !state.anchorHash, "La evaluación ya quedó vinculada al pasaporte.");
      const { risks } = checkpoint;
      requireValid(risks && Object.keys(risks).length === SAMPLE_PARCELS.length &&
        SAMPLE_PARCELS.every(({ id }) => risks[id] === "alerta" || risks[id] === "sin_riesgo"), "Evaluación incompleta.");
      return { ...state, risks };
    }
    case "credential": {
      const { credential } = checkpoint;
      requireValid(credential && typeof credential.id === "string" && credential.id.length <= 100 &&
        hashPattern.test(credential.root) && typeof credential.txHash === "string" &&
        (credential.txHash === "" || hashPattern.test(credential.txHash)), "Recibo ACTA inválido.");
      if (state.credential && state.credential.root !== credential.root) {
        throw new OperationError("La raíz de la credencial guardada no coincide.");
      }
      return { ...state, credential: state.credential ?? credential };
    }
    case "anchor":
      requireValid(state.credential && hashPattern.test(checkpoint.hash) && Number.isFinite(checkpoint.expires), "Recibo de anclaje inválido.");
      if (state.anchorHash === checkpoint.hash) return state;
      if (!canReplace(state.anchorHash, state.anchorExpires)) throw new OperationError("El anclaje anterior sigue pendiente o ya se confirmó.");
      return { ...state, anchorHash: checkpoint.hash, anchorExpires: checkpoint.expires };
    case "attested":
      requireValid(MILESTONES.includes(checkpoint.milestone) && hashPattern.test(checkpoint.hash), "Recibo de atestación inválido.");
      return { ...state, attestationHashes: { [checkpoint.milestone]: checkpoint.hash, ...state.attestationHashes } };
    case "deploy": {
      const { escrow } = checkpoint;
      requireValid(escrow && (escrow.asset === "USDC" || escrow.asset === "EURC") &&
        Number.isFinite(escrow.amount) && escrow.amount > 0 && walletPattern.test(escrow.buyer) &&
        !!escrow.deployHash && hashPattern.test(escrow.deployHash) && Number.isFinite(escrow.deployExpires), "Escrow inválido.");
      if (state.escrow?.deployHash === escrow.deployHash) return state;
      if (state.escrow?.contractId || !canReplace(state.escrow?.deployHash, state.escrow?.deployExpires)) {
        throw new OperationError("Ya existe un escrow para este lote o su creación está pendiente.");
      }
      if (state.escrow && state.escrow.buyer !== escrow.buyer) throw new OperationError("Conecta la cuenta del importador que inició el escrow.");
      return { ...state, escrow: { asset: escrow.asset, amount: escrow.amount, buyer: escrow.buyer, deployHash: escrow.deployHash, deployExpires: escrow.deployExpires } };
    }
    case "deployed":
      requireValid(state.escrow && contractPattern.test(checkpoint.contractId), "Contrato inválido.");
      if (state.escrow.contractId && checkpoint.contractId !== state.escrow.contractId) {
        throw new OperationError("El lote ya tiene un escrow vinculado.");
      }
      return { ...state, escrow: { ...state.escrow, contractId: checkpoint.contractId } };
    case "fund":
      requireValid(state.escrow?.contractId && hashPattern.test(checkpoint.hash) && Number.isFinite(checkpoint.expires), "Recibo de fondeo inválido.");
      if (state.escrow.fundHash === checkpoint.hash) return state;
      if (state.escrow.fundConfirmed || !canReplace(state.escrow.fundHash, state.escrow.fundExpires)) {
        throw new OperationError("El fondeo anterior sigue pendiente o ya se confirmó.");
      }
      return { ...state, escrow: { ...state.escrow, fundHash: checkpoint.hash, fundExpires: checkpoint.expires } };
  }
}
