import "server-only";
// Demo guiada con una sola wallet.
//
// Quien prueba elige un rol y conecta su wallet. Cada paso de su rol vuelve
// como XDR sin firmar (firma su wallet); los pasos de los demás roles los firma
// el servidor con las cuentas de la casa. La regla central no cambia: Alpha Pass
// libera un hito solo si LotPassport.is_attested devuelve true.
import { MILESTONES, type Milestone } from "../domain";
import { initialLot, RECORDED_RISK, SAMPLE_PARCELS, TESTNET_ESCROW_AMOUNT } from "../sample-data";
import { passportRoot, sha256Hex } from "../merkle";
import { serverEnv } from "./env";
import { TW } from "./trustless-work";
import { buildEscrowDeploy } from "./escrow-deploy";
import { cooperativeForLotOnChain, escrowEngagementId, isAttestedOnChain, readEscrowMilestones, signWithApprover } from "./stellar";
import { assessWithWhisp } from "./whisp-assess";
import { issueLotCredential } from "./acta-issuer";
import {
  attestArgs,
  createLotArgs,
  ensureHouseBuyerUsdc,
  houseKeypair,
  invokePassportAsHouse,
  preparePassportCall,
  signWith,
  type HouseRole,
} from "./house";
import { registerTestVerifier } from "./testnet";

export type DemoRole = HouseRole;
export type Risks = Record<string, "sin_riesgo" | "alerta">;
export type DemoResult =
  | { signer: "user"; unsignedXdr: string; kind: "soroban" | "escrow" | "classic" }
  | { signer: "house"; hash?: string; contractId?: string; [k: string]: unknown };

export class DemoError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const DEMO_LOT = /^2026-JAE-014-D[A-Z0-9]{6}$/;

export function newDemoLotId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
  return `2026-JAE-014-D${suffix}`;
}

function assertLot(lotId: unknown): asserts lotId is string {
  if (typeof lotId !== "string" || !DEMO_LOT.test(lotId)) throw new DemoError("Lote de demo inválido.");
}

function assertRisks(risks: unknown): asserts risks is Risks {
  if (!risks || typeof risks !== "object") throw new DemoError("Faltan los resultados de Whisp.");
  for (const p of SAMPLE_PARCELS) {
    const r = (risks as Record<string, unknown>)[p.id];
    if (r !== "sin_riesgo" && r !== "alerta") throw new DemoError("Resultados de Whisp incompletos.");
  }
}

/** Lote, parcelas aptas y raíz Merkle a partir de los resultados de Whisp. */
async function passport(lotId: string, risks: Risks) {
  const lot = initialLot(lotId);
  lot.parcels = lot.parcels.map((p) => ({ ...p, risk: risks[p.id] }));
  const eligible = lot.parcels.filter((p) => p.risk === "sin_riesgo");
  if (eligible.length === 0) throw new DemoError("Ninguna parcela quedó apta: no se puede anclar el lote.");
  return { lot, eligible, root: await passportRoot(lot, eligible), bags: eligible.reduce((s, p) => s + p.bags, 0) };
}

const evidenceHash = (lotId: string, milestone: Milestone) => sha256Hex(`${lotId}:${milestone}:evidencia-demo`);

// ---------- Pasos ----------

/** Paso 1 · Whisp evalúa las parcelas del lote de ejemplo. Si Whisp no responde, usa la respuesta grabada y lo dice. */
export async function assess() {
  try {
    const { risks, whispVersion } = await assessWithWhisp(SAMPLE_PARCELS);
    return { signer: "house" as const, risks, source: "whisp", whispVersion };
  } catch {
    return { signer: "house" as const, risks: RECORDED_RISK, source: "grabada", whispVersion: null };
  }
}

/** Dirección de la cooperativa de la operación: la wallet del usuario o la de la casa. */
function cooperativeAddress(role: DemoRole, user: string) {
  return role === "cooperativa" ? user : houseKeypair("cooperativa").publicKey();
}

/** Paso 2 · ACTA emite la credencial W3C del lote en la bóveda de la cooperativa. */
export async function credential(lotId: unknown, risks: unknown, role: DemoRole, user: string) {
  assertLot(lotId);
  assertRisks(risks);
  const { lot, eligible, root } = await passport(lotId, risks);
  const result = await issueLotCredential({
    lotId, owner: cooperativeAddress(role, user), cooperative: lot.cooperative, passportRoot: root,
    parcels: eligible.map(({ id, bags, risk }) => ({ id, bags, risk })),
  });
  return { signer: "house" as const, hash: result.txId, root, ...result };
}

/** Paso 3 · create_lot en LotPassport, firmado por la cooperativa. */
export async function anchor(lotId: unknown, risks: unknown, role: DemoRole, user: string): Promise<DemoResult> {
  assertLot(lotId);
  assertRisks(risks);
  const { eligible, root, bags } = await passport(lotId, risks);
  if (role === "cooperativa") {
    return { signer: "user", kind: "soroban", unsignedXdr: await preparePassportCall(user, "create_lot", createLotArgs(user, lotId, root, eligible.length, bags)) };
  }
  const hash = await invokePassportAsHouse("cooperativa", "create_lot", (coop) => createLotArgs(coop, lotId, root, eligible.length, bags));
  return { signer: "house", hash, root };
}

function usdcIssuer() {
  const issuer = process.env.NEXT_PUBLIC_USDC_ISSUER;
  if (!issuer) throw new DemoError("Falta NEXT_PUBLIC_USDC_ISSUER.", 503);
  return issuer;
}

/** Paso 4 · el importador crea el escrow de 3 hitos (Trustless Work). */
export async function escrowDeploy(lotId: unknown, role: DemoRole, user: string): Promise<DemoResult> {
  assertLot(lotId);
  const receiver = await cooperativeForLotOnChain(lotId);
  const buyer = role === "importador" ? user : houseKeypair("importador").publicKey();
  const unsigned = await TW.deploy(buildEscrowDeploy({
    signer: buyer, lotId, asset: "USDC", amount: TESTNET_ESCROW_AMOUNT, receiver, issuer: usdcIssuer(), roles: serverEnv.roles(),
  }));
  if (role === "importador") return { signer: "user", kind: "escrow", unsignedXdr: unsigned.unsignedXdr };
  const sent = await TW.send(signWith(houseKeypair("importador"), unsigned.unsignedXdr));
  if (!sent.contractId) throw new DemoError("Trustless Work no devolvió el contrato del escrow.", 502);
  return { signer: "house", hash: sent.txHash, contractId: sent.contractId };
}

/** Paso 5 · el importador deposita los USDC de prueba en el escrow. */
export async function escrowFund(lotId: unknown, contractId: unknown, role: DemoRole, user: string): Promise<DemoResult> {
  assertLot(lotId);
  if (typeof contractId !== "string" || (await escrowEngagementId(contractId)) !== lotId) {
    throw new DemoError("Ese escrow no corresponde a este lote.");
  }
  if (role === "importador") {
    const unsigned = await TW.fund({ contractId, signer: user, amount: TESTNET_ESCROW_AMOUNT });
    return { signer: "user", kind: "escrow", unsignedXdr: unsigned.unsignedXdr };
  }
  await ensureHouseBuyerUsdc(TESTNET_ESCROW_AMOUNT);
  const buyer = houseKeypair("importador");
  const unsigned = await TW.fund({ contractId, signer: buyer.publicKey(), amount: TESTNET_ESCROW_AMOUNT });
  const sent = await TW.send(signWith(buyer, unsigned.unsignedXdr));
  return { signer: "house", hash: sent.txHash };
}

function assertMilestone(m: unknown): asserts m is Milestone {
  if (!MILESTONES.includes(m as Milestone)) throw new DemoError("Hito inválido.");
}

/** Pasos 6, 8 y 10 · el verificador firma el hito con el hash de su evidencia. */
export async function attest(lotId: unknown, milestone: unknown, role: DemoRole, user: string): Promise<DemoResult> {
  assertLot(lotId);
  assertMilestone(milestone);
  const hash = await evidenceHash(lotId, milestone);
  if (role === "verificador") {
    return { signer: "user", kind: "soroban", unsignedXdr: await preparePassportCall(user, "attest", attestArgs(user, lotId, milestone, hash)) };
  }
  const tx = await invokePassportAsHouse("verificador", "attest", (issuer) => attestArgs(issuer, lotId, milestone, hash));
  return { signer: "house", hash: tx };
}

/**
 * Pasos 7, 9 y 11 · Alpha Pass aprueba y libera el hito solo si LotPassport
 * confirma la atestación. Sin atestación responde 409 y el dinero no se mueve.
 */
export async function release(lotId: unknown, contractId: unknown, milestone: unknown) {
  assertLot(lotId);
  assertMilestone(milestone);
  if (typeof contractId !== "string" || (await escrowEngagementId(contractId)) !== lotId) {
    throw new DemoError("Ese escrow no corresponde a este lote: no se libera.", 409);
  }
  if (!(await isAttestedOnChain(lotId, milestone))) {
    throw new DemoError("LotPassport no tiene la atestación de este hito: no se libera.", 409);
  }
  const index = MILESTONES.indexOf(milestone);
  const flags = await readEscrowMilestones(contractId, lotId);
  if (flags[index].released) return { signer: "house" as const, alreadyReleased: true };
  if (index > 0 && !flags[index - 1].released) throw new DemoError("Primero debe liberarse el hito anterior.", 409);
  const approver = serverEnv.roles().approver;
  if (!flags[index].approved) {
    const approve = await TW.approve({ contractId, approver, milestoneIndexes: [index] });
    await TW.send(signWithApprover(approve.unsignedXdr));
  }
  const unsigned = await TW.release({ contractId, releaseSigner: approver, milestoneIndexes: [index] });
  const sent = await TW.send(signWithApprover(unsigned.unsignedXdr));
  return { signer: "house" as const, hash: sent.txHash };
}

/** El verificador elegido por el usuario necesita permiso en LotPassport (lo firma la administradora). */
export async function prepareVerifier(user: string) {
  return registerTestVerifier(user);
}
