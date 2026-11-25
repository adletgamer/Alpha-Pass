// Prepara las cuentas "de la casa" para la demo guiada de una sola wallet (Stellar Testnet).
//
// Uso (desde apps/web):  npm run demo:setup
//
// 1. Crea las cuentas que falten (cooperativa, importador y verificador de la casa) y
//    guarda sus secretos en .env.local. Nunca los imprime.
// 2. Las fondea con Friendbot, abre la trustline de USDC de prueba y compra USDC para
//    el importador en el DEX de Testnet (objetivo: TARGET_USDC).
// 3. Registra al verificador de la casa en LotPassport para los tres hitos (firma la
//    cuenta administradora ALPHA_ADMIN_SECRET).
// 4. Si existe ALPHA_ACTA_ISSUER_SECRET (la wallet de la API key de ACTA), registra
//    su did:stellar una sola vez y guarda la identidad en ALPHA_ACTA_ISSUER_IDENTITY.
// Se puede repetir: cada paso comprueba primero si ya está hecho.
import { appendFileSync, readFileSync } from "node:fs";
import {
  Account, Asset, Contract, Horizon, Keypair, Networks, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const ENV_FILE = process.argv[2] ?? ".env.local";
const HORIZON = new Horizon.Server("https://horizon-testnet.stellar.org");
const RPC = new rpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org");
const PASSPORT = process.env.NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID;
const USDC = new Asset("USDC", process.env.NEXT_PUBLIC_USDC_ISSUER ?? "");
const TARGET_USDC = Number(process.env.DEMO_TARGET_USDC ?? 1000);
const MILESTONES = ["Acopio", "Embarque", "Llegada"];

if (process.env.NEXT_PUBLIC_STELLAR_NETWORK && process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
  throw new Error("La demo de la casa solo existe en Stellar Testnet.");
}
if (!PASSPORT || !USDC.issuer) throw new Error("Faltan NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID o NEXT_PUBLIC_USDC_ISSUER en el entorno.");

const step = (msg) => console.log(`· ${msg}`);

function saveEnv(name, value) {
  const current = readFileSync(ENV_FILE, "utf8");
  if (new RegExp(`^${name}=.+`, "m").test(current)) return;
  appendFileSync(ENV_FILE, `${current.endsWith("\n") ? "" : "\n"}${name}=${value}\n`);
  process.env[name] = value.replace(/^'|'$/g, "");
}

function houseAccount(name) {
  const secretVar = `ALPHA_DEMO_${name}_SECRET`;
  let secret = process.env[secretVar]?.trim();
  if (!secret) {
    secret = Keypair.random().secret();
    saveEnv(secretVar, secret);
    step(`${name}: cuenta nueva guardada en ${ENV_FILE}`);
  }
  const kp = Keypair.fromSecret(secret);
  saveEnv(`ALPHA_DEMO_${name}_PUBLIC`, kp.publicKey());
  return kp;
}

async function load(address) {
  try { return await HORIZON.loadAccount(address); } catch { return null; }
}

async function friendbot(kp, label) {
  if (await load(kp.publicKey())) return;
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot respondió ${res.status} para ${label}.`);
  step(`${label}: 10 000 XLM de Friendbot`);
}

async function classic(kp, ops) {
  const account = await HORIZON.loadAccount(kp.publicKey());
  const builder = new TransactionBuilder(account, { fee: "10000", networkPassphrase: Networks.TESTNET });
  for (const op of ops) builder.addOperation(op);
  const tx = builder.setTimeout(120).build();
  tx.sign(kp);
  return (await HORIZON.submitTransaction(tx)).hash;
}

const usdcLine = (acc) => acc.balances.find((b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer);

async function trustline(kp, label) {
  if (usdcLine(await HORIZON.loadAccount(kp.publicKey()))) return;
  await classic(kp, [Operation.changeTrust({ asset: USDC })]);
  step(`${label}: trustline de USDC abierta`);
}

async function topUpUsdc(kp, label) {
  let balance = Number(usdcLine(await HORIZON.loadAccount(kp.publicKey()))?.balance ?? 0);
  while (balance < TARGET_USDC) {
    await classic(kp, [Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(), sendMax: "900", destination: kp.publicKey(), destAsset: USDC, destAmount: "200", path: [],
    })]);
    balance = Number(usdcLine(await HORIZON.loadAccount(kp.publicKey())).balance);
  }
  step(`${label}: ${balance.toFixed(2)} USDC de prueba`);
}

async function simulate(method, ...args) {
  const tx = new TransactionBuilder(new Account(Keypair.random().publicKey(), "0"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(PASSPORT).call(method, ...args)).setTimeout(30).build();
  const sim = await RPC.simulateTransaction(tx);
  return rpc.Api.isSimulationError(sim) ? null : scValToNative(sim.result.retval);
}

async function invoke(kp, method, args) {
  const account = await RPC.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(PASSPORT).call(method, ...args)).setTimeout(120).build();
  const prepared = await RPC.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await RPC.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${method} rechazado`);
  for (let i = 0; i < 40; i++) {
    const r = await RPC.getTransaction(sent.hash);
    if (r.status === "SUCCESS") return sent.hash;
    if (r.status === "FAILED") throw new Error(`${method} falló`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${method} no confirmó a tiempo`);
}

async function registerVerifier(kp) {
  const adminSecret = process.env.ALPHA_ADMIN_SECRET?.trim();
  if (!adminSecret) throw new Error("Falta ALPHA_ADMIN_SECRET para autorizar al verificador de la casa.");
  const admin = Keypair.fromSecret(adminSecret);
  for (const m of MILESTONES) {
    const milestone = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(m)]);
    const address = nativeToScVal(kp.publicKey(), { type: "address" });
    if (await simulate("is_issuer", address, milestone)) continue;
    await invoke(admin, "set_issuer", [address, milestone, nativeToScVal(true)]);
    step(`Verificador: autorizado para ${m}`);
  }
}

async function actaIdentity() {
  const secret = process.env.ALPHA_ACTA_ISSUER_SECRET?.trim();
  if (!secret) {
    console.log("\n! Falta ALPHA_ACTA_ISSUER_SECRET: la emisión ACTA quedará deshabilitada en la demo.");
    console.log("  Agrega en .env.local el secreto de la wallet de Testnet con la que se creó ACTA_API_KEY y repite npm run demo:setup.");
    return;
  }
  const kp = Keypair.fromSecret(secret);
  await friendbot(kp, "Emisora ACTA");
  if (process.env.ALPHA_ACTA_ISSUER_IDENTITY?.trim()) {
    step("Emisora ACTA: identidad did:stellar ya registrada");
    return;
  }
  const { ActaClient, InMemoryIssuerIdentityStorage } = await import("@acta-team/credentials");
  const storage = new InMemoryIssuerIdentityStorage();
  const acta = new ActaClient(process.env.ACTA_API_URL ?? "https://sandbox-api.acta.build", process.env.ACTA_API_KEY, { storage });
  const signTransaction = async (unsigned) => {
    const tx = TransactionBuilder.fromXDR(unsigned, Networks.TESTNET);
    tx.sign(kp);
    return tx.toXDR();
  };
  const identity = await acta.getOrCreateIssuerIdentity({ controller: kp.publicKey(), signTransaction });
  saveEnv("ALPHA_ACTA_ISSUER_IDENTITY", `'${JSON.stringify(identity)}'`);
  step(`Emisora ACTA: ${identity.did} registrada y guardada en ${ENV_FILE}`);
}

const coop = houseAccount("COOP");
const buyer = houseAccount("BUYER");
const verifier = houseAccount("VERIFIER");

for (const [kp, label] of [[coop, "Cooperativa"], [buyer, "Importador"], [verifier, "Verificador"]]) await friendbot(kp, label);
await trustline(coop, "Cooperativa");
await trustline(buyer, "Importador");
await topUpUsdc(buyer, "Importador");
await registerVerifier(verifier);
await actaIdentity();

console.log("\nCuentas de la casa (direcciones públicas):");
console.log(`  Cooperativa  ${coop.publicKey()}`);
console.log(`  Importador   ${buyer.publicKey()}`);
console.log(`  Verificador  ${verifier.publicKey()}`);
console.log("\nCopia las variables ALPHA_DEMO_* y ALPHA_ACTA_* de .env.local al entorno de Vercel (sin prefijo NEXT_PUBLIC_).");
