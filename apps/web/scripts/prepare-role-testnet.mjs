import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Contract, Networks, TransactionBuilder, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import { initialLot } from "../src/lib/sample-data.ts";
import { passportRoot, sha256Hex } from "../src/lib/merkle.ts";

const [configDir, lotId, origin = "http://127.0.0.1:3160"] = process.argv.slice(2);
assert.ok(configDir && /^2026-JAE-014-[A-Z0-9]{4,16}$/.test(lotId ?? ""), "Indica el directorio Stellar CLI y un ID nuevo para el lote.");
const url = new URL(origin);
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "La prueba usa una app local de Testnet.");
assert.equal(process.env.NEXT_PUBLIC_STELLAR_NETWORK, "testnet");
const contract = new Contract(process.env.NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID);
const stellar = new rpc.Server(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL);
const amount = 150;
const variants = { acopio: "Acopio", embarque: "Embarque", llegada: "Llegada" };

function cli(args, input) {
  return execFileSync("stellar", [...args, "--config-dir", configDir, "--quiet"], { encoding: "utf8", input, stdio: ["pipe", "pipe", "ignore"] }).trim();
}

function signer(role) {
  const name = `alpha-${role}`;
  return { name, address: cli(["keys", "address", name]) };
}

function sign(unsigned, account) {
  return cli(["tx", "sign", "--network", "testnet", "--sign-with-key", account.name], `${unsigned}\n`);
}

async function post(path, body, expected = 200) {
  const response = await fetch(new URL(path, url), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(85000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, data.message ?? data.code ?? path);
  return data;
}

async function invoke(account, method, args) {
  const source = await stellar.getAccount(account.address);
  const tx = new TransactionBuilder(source, { fee: "1000000", networkPassphrase: Networks.TESTNET })
    .addOperation(contract.call(method, ...args)).setTimeout(120).build();
  const prepared = await stellar.prepareTransaction(tx);
  const signed = TransactionBuilder.fromXDR(sign(prepared.toXDR(), account), Networks.TESTNET);
  const sent = await stellar.sendTransaction(signed);
  assert.notEqual(sent.status, "ERROR", method);
  for (let attempt = 0; attempt < 25; attempt++) {
    const receipt = await stellar.getTransaction(sent.hash);
    if (receipt.status === "SUCCESS") return sent.hash;
    assert.notEqual(receipt.status, "FAILED", method);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`La transacción ${method} no se confirmó a tiempo.`);
}

const coop = signer("cooperativa");
const importer = signer("importador");
const verifier = signer("verificador");
const accountStatus = (account) => post("/api/testnet", { action: "status", address: account.address });

async function prepare(account, action) {
  const tx = await post("/api/testnet", { action, address: account.address });
  await post("/api/testnet", { action: "submit", signedXdr: sign(tx.unsignedXdr, account) });
}

const receiver = await accountStatus(coop);
if (!receiver.hasUsdcTrustline) await prepare(coop, "trustline");
if (Number((await accountStatus(importer)).usdc) < amount) await prepare(importer, "usdc");
console.log("Saldos y líneas de confianza preparados.");

const lot = initialLot(lotId);
const assessment = await post("/api/whisp", { parcels: lot.parcels.map(({ id, geometry }) => ({ id, geometry })) });
for (const parcel of lot.parcels) {
  const risk = assessment.risks[parcel.id];
  assert.ok(risk === "alerta" || risk === "sin_riesgo", parcel.id);
  parcel.risk = risk;
}
const included = lot.parcels.filter((parcel) => parcel.risk === "sin_riesgo");
assert.ok(included.length);
const root = await passportRoot(lot, included);
const id = nativeToScVal(lotId, { type: "string" });
const wallet = (account) => nativeToScVal(account.address, { type: "address" });
const bytes = (hex) => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
const anchor = await invoke(coop, "create_lot", [
  wallet(coop), id, bytes(root), nativeToScVal(included.length, { type: "u32" }),
  nativeToScVal(included.reduce((total, parcel) => total + parcel.bags, 0), { type: "u32" }),
]);
console.log(`Anclaje de ${lotId}: ${anchor}`);

const deploy = await post("/api/escrow", { action: "deploy", signer: importer.address, lotId, asset: "USDC", amount });
const deployed = await post("/api/escrow", { action: "submit", signedXdr: sign(deploy.unsignedXdr, importer) });
const contractId = deployed.contractId ?? deploy.contractId;
assert.match(contractId, /^C[A-Z2-7]{55}$/);
console.log(`Escrow: ${contractId}`);
const funding = await post("/api/escrow", { action: "fund", contractId, signer: importer.address, amount });
const funded = await post("/api/escrow", { action: "submit", signedXdr: sign(funding.unsignedXdr, importer) });
console.log(`Fondeo: ${funded.txHash}`);

await post("/api/escrow/release", { contractId, lotId, milestone: "acopio" }, 409);
console.log("Liberación retenida antes de la atestación.");
await post("/api/testnet", { action: "verifier", address: verifier.address });
for (const [milestone, variant] of Object.entries(variants)) {
  const evidence = await sha256Hex(`${lotId}:${milestone}:documento logístico de prueba`);
  const proof = await invoke(verifier, "attest", [wallet(verifier), id, xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variant)]), bytes(evidence)]);
  const payment = await post("/api/escrow/release", { contractId, lotId, milestone });
  console.log(`${milestone} · atestación ${proof} · pago ${payment.releaseTx}`);
}
const record = await fetch(new URL(`/api/lote/${lotId}`, url)).then((response) => response.json());
assert.equal(record.passportRoot, root);
assert.equal(record.attestations.length, 3);
const received = Number((await accountStatus(coop)).usdc) - Number(receiver.usdc);
assert.ok(received > 0);
console.log(`Pasaporte y atestaciones verificados. Abono a cooperativa: ${received.toFixed(2)} USDC de prueba.`);
if (Number((await accountStatus(importer)).usdc) < amount) await prepare(importer, "usdc");
