import "server-only";
// Herramientas solo para Stellar Testnet: dejar lista cualquier wallet para probar
// el flujo completo (XLM de friendbot, USDC de prueba vía DEX y rol de verificador).
// Nada de esto existe en mainnet: cada función rechaza si la red no es testnet.
import {
  Account,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { serverEnv } from "./env";
import { MILESTONES, type Milestone } from "../domain";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const VARIANT: Record<Milestone, string> = { acopio: "Acopio", embarque: "Embarque", llegada: "Llegada" };

/** USDC que recibe cada wallet de prueba (los 3 hitos del escrow de Testnet suman menos). */
export const TEST_USDC_AMOUNT = "200";
/** Tope de XLM que se gasta en el DEX para obtenerlo. */
const MAX_XLM_FOR_USDC = "600";

export function assertTestnet() {
  if (serverEnv.network !== "testnet") throw new Error("Solo disponible en Stellar Testnet.");
}

export function assertAddress(address: unknown): asserts address is string {
  if (typeof address !== "string" || !StrKey.isValidEd25519PublicKey(address)) {
    throw new Error("Dirección Stellar inválida.");
  }
}

function usdc() {
  const issuer = process.env.NEXT_PUBLIC_USDC_ISSUER;
  if (!issuer) throw new Error("Falta NEXT_PUBLIC_USDC_ISSUER.");
  return new Asset("USDC", issuer);
}

const horizon = () => new Horizon.Server(HORIZON_URL);

export interface WalletStatus {
  exists: boolean;
  xlm: string;
  hasUsdcTrustline: boolean;
  usdc: string;
  verifierFor: Milestone[];
}

export async function walletStatus(address: string): Promise<WalletStatus> {
  const verifierFor = await verifierMilestones(address);
  try {
    const acc = await horizon().loadAccount(address);
    const native = acc.balances.find((b) => b.asset_type === "native");
    const u = usdc();
    const line = acc.balances.find(
      (b) => "asset_code" in b && b.asset_code === u.code && "asset_issuer" in b && b.asset_issuer === u.issuer,
    );
    return { exists: true, xlm: native?.balance ?? "0", hasUsdcTrustline: Boolean(line), usdc: line?.balance ?? "0", verifierFor };
  } catch (err) {
    if (err instanceof Error && /not found|404/i.test(err.message)) {
      return { exists: false, xlm: "0", hasUsdcTrustline: false, usdc: "0", verifierFor };
    }
    throw err;
  }
}

/** Fondea la cuenta con XLM de prueba (friendbot). Idempotente: si ya existe, no hace nada. */
export async function fundWithFriendbot(address: string) {
  const status = await walletStatus(address);
  if (status.exists) return { funded: false };
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Friendbot respondió ${res.status}. Intenta en un minuto.`);
  return { funded: true };
}

/**
 * Transacción sin firmar para la wallet del usuario: abre la trustline de USDC
 * (si falta) y compra USDC de prueba con su propio XLM en el DEX de Testnet.
 * Alpha Pass no custodia ni envía fondos: el usuario firma y paga con su XLM.
 */
export async function buildGetUsdcTx(address: string): Promise<string> {
  const status = await walletStatus(address);
  if (!status.exists) throw new Error("La cuenta todavía no existe en Testnet: pide XLM primero.");
  const acc = await horizon().loadAccount(address);
  const u = usdc();
  const builder = new TransactionBuilder(acc, { fee: "10000", networkPassphrase: Networks.TESTNET });
  if (!status.hasUsdcTrustline) builder.addOperation(Operation.changeTrust({ asset: u }));
  builder.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: MAX_XLM_FOR_USDC,
      destination: address,
      destAsset: u,
      destAmount: TEST_USDC_AMOUNT,
      path: [],
    }),
  );
  return builder.setTimeout(180).build().toXDR();
}

/** Para la cuenta que cobra basta habilitar la recepción del activo. */
export async function buildUsdcTrustlineTx(address: string): Promise<string> {
  const acc = await horizon().loadAccount(address);
  return new TransactionBuilder(acc, { fee: "10000", networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: usdc() }))
    .setTimeout(180)
    .build()
    .toXDR();
}

/** Envía a Horizon una transacción clásica ya firmada por la wallet. */
export async function submitClassic(signedXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  try {
    const res = await horizon().submitTransaction(tx);
    return { hash: res.hash };
  } catch (err) {
    const codes = (err as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data?.extras?.result_codes;
    throw new Error(`Horizon rechazó la transacción${codes ? `: ${JSON.stringify(codes)}` : ""}.`);
  }
}

// ---------- LotPassport ----------

async function simulate(method: string, ...args: xdr.ScVal[]) {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(serverEnv.lotPassportId()).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return null;
  return sim.result?.retval ?? null;
}

const milestoneScVal = (m: Milestone) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(VARIANT[m])]);

export async function verifierMilestones(address: string): Promise<Milestone[]> {
  const res = await Promise.all(
    MILESTONES.map(async (m) => {
      const r = await simulate("is_issuer", nativeToScVal(address, { type: "address" }), milestoneScVal(m));
      return r && scValToNative(r) === true ? m : null;
    }),
  );
  return res.filter((m): m is Milestone => m !== null);
}

/**
 * Registra la wallet como verificadora de prueba de los tres hitos (firma la
 * cuenta administradora de LotPassport en el servidor). Solo Testnet.
 */
export async function registerTestVerifier(address: string) {
  const already = await verifierMilestones(address);
  const missing = MILESTONES.filter((m) => !already.includes(m));
  if (missing.length === 0) return { registered: [] as Milestone[] };
  const admin = Keypair.fromSecret(process.env.ALPHA_ADMIN_SECRET?.trim() ?? "");
  const server = new rpc.Server(serverEnv.rpcUrl);
  const contract = new Contract(serverEnv.lotPassportId());
  const hashes: string[] = [];
  for (const m of missing) {
    const account = await server.getAccount(admin.publicKey());
    const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call("set_issuer", nativeToScVal(address, { type: "address" }), milestoneScVal(m), nativeToScVal(true)))
      .setTimeout(60)
      .build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(admin);
    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") throw new Error("La red rechazó el registro del verificador.");
    let done = false;
    for (let i = 0; i < 20 && !done; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await server.getTransaction(sent.hash);
      if (st.status === rpc.Api.GetTransactionStatus.SUCCESS) done = true;
      else if (st.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error("LotPassport rechazó set_issuer.");
    }
    if (!done) throw new Error("El registro del verificador no se confirmó a tiempo.");
    hashes.push(sent.hash);
  }
  return { registered: missing, hashes };
}
