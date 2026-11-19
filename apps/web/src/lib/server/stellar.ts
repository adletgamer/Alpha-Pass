import "server-only";
import {
  Account,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { serverEnv } from "./env";
import type { Milestone } from "../domain";

const PASSPHRASE = serverEnv.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/** Variante del enum Milestone de LotPassport (contracttype unit enum = vec[symbol]). */
const MILESTONE_VARIANT: Record<Milestone, string> = {
  acopio: "Acopio",
  embarque: "Embarque",
  llegada: "Llegada",
};

function milestoneScVal(m: Milestone): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(MILESTONE_VARIANT[m])]);
}

async function readContract(method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  return readAt(serverEnv.lotPassportId(), method, ...args);
}

async function readAt(contractId: string, method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const contract = new Contract(contractId);
  // Cuenta ficticia: la simulación de una lectura no necesita una cuenta real.
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  const ret = sim.result?.retval;
  if (!ret) throw new Error(`${method} no devolvió un resultado.`);
  return scValToNative(ret);
}

/** La dirección del beneficiario proviene del lote anclado, nunca del comprador. */
export async function cooperativeForLotOnChain(lotId: string): Promise<string> {
  const lot = await readContract("get_lot", nativeToScVal(lotId, { type: "string" }));
  if (!lot || typeof lot !== "object" || !("cooperative" in lot) || typeof lot.cooperative !== "string") {
    throw new Error("LotPassport no devolvió la dirección de la cooperativa.");
  }
  return lot.cooperative;
}

/** Lee LotPassport.is_attested simulando la llamada (sin firmar ni pagar). */
export async function isAttestedOnChain(lotId: string, milestone: Milestone): Promise<boolean> {
  return Boolean(await readContract("is_attested", nativeToScVal(lotId, { type: "string" }), milestoneScVal(milestone)));
}

/** Firma con la cuenta de servicio (aprobadora) un XDR devuelto por Trustless Work. */
export function signWithApprover(unsignedXdr: string): string {
  const kp = Keypair.fromSecret(serverEnv.roles().approverSecret);
  const tx = TransactionBuilder.fromXDR(unsignedXdr, PASSPHRASE);
  tx.sign(kp);
  return tx.toXDR();
}

const hex = (v: unknown) => (v instanceof Uint8Array ? Buffer.from(v).toString("hex") : String(v ?? ""));

export interface OnChainLot {
  lotId: string;
  cooperative: string;
  passportRoot: string;
  parcels: number;
  bags: number;
  createdAt: number;
  attestations: { milestone: Milestone; issuer: string; evidenceHash: string; timestamp: number }[];
}

/** Lee el lote y sus atestaciones directamente de LotPassport (null si no existe). */
export async function readLotOnChain(lotId: string): Promise<OnChainLot | null> {
  const id = nativeToScVal(lotId, { type: "string" });
  let lot: Record<string, unknown>;
  try {
    lot = (await readContract("get_lot", id)) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && /Error\(Contract, #2\)|LotNotFound/.test(err.message)) return null;
    throw err;
  }
  const attestations: OnChainLot["attestations"] = [];
  for (const m of Object.keys(MILESTONE_VARIANT) as Milestone[]) {
    const a = (await readContract("get_attestation", id, milestoneScVal(m)).catch(() => null)) as Record<string, unknown> | null;
    if (a) attestations.push({ milestone: m, issuer: String(a.issuer), evidenceHash: hex(a.evidence_hash), timestamp: Number(a.timestamp) });
  }
  return {
    lotId,
    cooperative: String(lot.cooperative),
    passportRoot: hex(lot.passport_root),
    parcels: Number(lot.parcels),
    bags: Number(lot.bags),
    createdAt: Number(lot.created_at),
    attestations,
  };
}

/**
 * engagement_id del escrow de Trustless Work, leído del propio contrato.
 * Alpha Pass usa el ID del lote como engagement_id al desplegarlo.
 */
export async function escrowEngagementId(contractId: string): Promise<string | null> {
  if (!/^C[A-Z2-7]{55}$/.test(contractId)) return null;
  const escrow = (await readAt(contractId, "get_escrow").catch(() => null)) as Record<string, unknown> | null;
  const value = escrow?.engagement_id ?? escrow?.engagementId;
  return typeof value === "string" ? value : null;
}
