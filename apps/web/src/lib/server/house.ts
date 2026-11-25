import "server-only";
// Cuentas "de la casa" para la demo guiada de Stellar Testnet.
//
// Quien prueba Alpha Pass conecta una sola wallet y elige un rol. Las otras
// partes de la operación (cooperativa, importador o verificador) las firma el
// servidor con cuentas de prueba propias, fondeadas con Friendbot y USDC de
// prueba (`npm run demo:setup`). Sus secretos viven solo en el servidor.
// Nada de esto funciona fuera de Testnet.
import {
  Asset,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { MissingEnvError, serverEnv } from "./env";
import type { Milestone } from "../domain";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const VARIANT: Record<Milestone, string> = { acopio: "Acopio", embarque: "Embarque", llegada: "Llegada" };

export type HouseRole = "cooperativa" | "importador" | "verificador";

const HOUSE_ENV: Record<HouseRole, string> = {
  cooperativa: "ALPHA_DEMO_COOP_SECRET",
  importador: "ALPHA_DEMO_BUYER_SECRET",
  verificador: "ALPHA_DEMO_VERIFIER_SECRET",
};

export function houseKeypair(role: HouseRole): Keypair {
  const name = HOUSE_ENV[role];
  const secret = process.env[name]?.trim();
  if (!secret) throw new MissingEnvError(name);
  return Keypair.fromSecret(secret);
}

export function houseConfigured(role: HouseRole): boolean {
  return Boolean(process.env[HOUSE_ENV[role]]?.trim());
}

export const milestoneScVal = (m: Milestone) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(VARIANT[m])]);

export function bytes32(hex: string): xdr.ScVal {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Se esperaba un hash SHA-256 en hexadecimal.");
  return xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
}

export function createLotArgs(cooperative: string, lotId: string, root: string, parcels: number, bags: number) {
  return [
    nativeToScVal(cooperative, { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    bytes32(root),
    nativeToScVal(parcels, { type: "u32" }),
    nativeToScVal(bags, { type: "u32" }),
  ];
}

export function attestArgs(issuer: string, lotId: string, milestone: Milestone, evidenceHash: string) {
  return [
    nativeToScVal(issuer, { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    milestoneScVal(milestone),
    bytes32(evidenceHash),
  ];
}

/** Transacción de LotPassport preparada (simulada) para que la firme `source`. */
export async function preparePassportCall(source: string, method: string, args: xdr.ScVal[]): Promise<string> {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(serverEnv.lotPassportId()).call(method, ...args))
    .setTimeout(180)
    .build();
  return (await server.prepareTransaction(tx)).toXDR();
}

/** Envía una transacción de Soroban firmada y espera su confirmación. */
export async function submitSoroban(signedXdr: string): Promise<string> {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error("La red rechazó la transacción de LotPassport.");
  for (let i = 0; i < 40; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error("LotPassport rechazó la operación.");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("La transacción de LotPassport no se confirmó a tiempo.");
}

/** La cuenta de la casa firma y envía una llamada a LotPassport. */
export async function invokePassportAsHouse(role: HouseRole, method: string, args: (address: string) => xdr.ScVal[]) {
  const kp = houseKeypair(role);
  const unsigned = await preparePassportCall(kp.publicKey(), method, args(kp.publicKey()));
  return submitSoroban(signWith(kp, unsigned));
}

export function signWith(kp: Keypair, unsignedXdr: string): string {
  const tx = TransactionBuilder.fromXDR(unsignedXdr, PASSPHRASE);
  tx.sign(kp);
  return tx.toXDR();
}

// ---------- USDC de prueba de la casa ----------

function usdc() {
  const issuer = process.env.NEXT_PUBLIC_USDC_ISSUER;
  if (!issuer) throw new MissingEnvError("NEXT_PUBLIC_USDC_ISSUER");
  return new Asset("USDC", issuer);
}

async function usdcBalance(address: string): Promise<number> {
  const acc = await new Horizon.Server(HORIZON_URL).loadAccount(address);
  const u = usdc();
  const line = acc.balances.find((b) => "asset_code" in b && b.asset_code === u.code && "asset_issuer" in b && b.asset_issuer === u.issuer);
  return Number(line?.balance ?? 0);
}

async function submitClassicAs(kp: Keypair, build: (b: TransactionBuilder) => TransactionBuilder) {
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(kp.publicKey());
  const tx = build(new TransactionBuilder(account, { fee: "10000", networkPassphrase: PASSPHRASE })).setTimeout(120).build();
  tx.sign(kp);
  return (await horizon.submitTransaction(tx)).hash;
}

/**
 * Deja al importador de la casa con al menos `amount` USDC de prueba.
 * Primero recupera lo que cobró la cooperativa de la casa en demos anteriores;
 * si no alcanza, compra USDC de prueba con XLM en el DEX de Testnet.
 */
export async function ensureHouseBuyerUsdc(amount: number) {
  const buyer = houseKeypair("importador");
  let balance = await usdcBalance(buyer.publicKey());
  if (balance >= amount) return balance;
  if (houseConfigured("cooperativa")) {
    const coop = houseKeypair("cooperativa");
    const coopBalance = await usdcBalance(coop.publicKey()).catch(() => 0);
    if (coopBalance >= 1) {
      await submitClassicAs(coop, (b) => b.addOperation(Operation.payment({
        destination: buyer.publicKey(), asset: usdc(), amount: coopBalance.toFixed(7),
      })));
      balance = await usdcBalance(buyer.publicKey());
    }
  }
  while (balance < amount) {
    await submitClassicAs(buyer, (b) => b.addOperation(Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(), sendMax: "900", destination: buyer.publicKey(), destAsset: usdc(), destAmount: "200", path: [],
    })));
    balance = await usdcBalance(buyer.publicKey());
  }
  return balance;
}
