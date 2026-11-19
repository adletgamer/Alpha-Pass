// Prueba de punta a punta en Stellar Testnet contra la app corriendo (pnpm dev / start).
// Crea cuentas nuevas (cooperativa, importador, verificador), las prepara con las mismas
// rutas que usa /probar y recorre: Whisp → LotPassport → escrow → 3 hitos → pasaporte público.
// Uso: node scripts/e2e-testnet.mjs http://localhost:3150
// No imprime secretos: las claves de prueba se generan en memoria y se descartan.
import { Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3150";
const RPC = "https://soroban-testnet.stellar.org";
const PASSPORT = process.env.NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID ?? "CDNM2H5XU3IR5YVE6TJJE36RPFIKWVQ2WEPNRSLAMW2JPAURETVCZ7BO";
const AMOUNT = 150;
const MILESTONES = ["acopio", "embarque", "llegada"];
const VARIANT = { acopio: "Acopio", embarque: "Embarque", llegada: "Llegada" };
const server = new rpc.Server(RPC);
const results = [];

const log = (step, ok, detail = "") => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${step}${detail ? ` · ${detail}` : ""}`);
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function must(step, fn) {
  try {
    const detail = await fn();
    log(step, true, detail ?? "");
  } catch (err) {
    log(step, false, err instanceof Error ? err.message : String(err));
    summary();
    process.exit(1);
  }
}

function sign(xdrStr, kp) {
  const tx = TransactionBuilder.fromXDR(xdrStr, Networks.TESTNET);
  tx.sign(kp);
  return tx.toXDR();
}

async function invoke(kp, method, args) {
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(PASSPORT).call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${method} rechazado al enviar`);
  for (let i = 0; i < 30; i++) {
    const r = await server.getTransaction(sent.hash);
    if (r.status === "SUCCESS") return sent.hash;
    if (r.status === "FAILED") throw new Error(`${method} falló en la red`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${method} no confirmó a tiempo`);
}

const sha = (s) => createHash("sha256").update(s).digest("hex");
const milestoneVal = (m) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(VARIANT[m])]);

async function prepareWallet(name, kp, { usdc = false, verifier = false } = {}) {
  await must(`${name}: XLM de friendbot`, async () => {
    const r = await post("/api/testnet", { action: "fund", address: kp.publicKey() });
    if (r.status !== 200) throw new Error(r.json.message);
    return kp.publicKey();
  });
  if (usdc) {
    await must(`${name}: 200 USDC de prueba (trustline + DEX)`, async () => {
      const b = await post("/api/testnet", { action: "usdc", address: kp.publicKey() });
      if (b.status !== 200) throw new Error(b.json.message);
      const s = await post("/api/testnet", { action: "submit", signedXdr: sign(b.json.unsignedXdr, kp) });
      if (s.status !== 200) throw new Error(s.json.message);
      return `tx ${s.json.hash}`;
    });
  }
  if (verifier) {
    await must(`${name}: rol de verificador en LotPassport`, async () => {
      const r = await post("/api/testnet", { action: "verifier", address: kp.publicKey() });
      if (r.status !== 200) throw new Error(r.json.message);
      const st = await post("/api/testnet", { action: "status", address: kp.publicKey() });
      if (st.json.verifierFor?.length !== 3) throw new Error(`solo ${st.json.verifierFor}`);
      return "3 hitos";
    });
  }
}

function summary() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} pasos OK`);
}

const coop = Keypair.random();
const buyer = Keypair.random();
const verifier = Keypair.random();
const lotId = `2026-JAE-014-E2E${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
console.log(`Lote ${lotId}\n`);

await prepareWallet("Cooperativa", coop, { usdc: true });
await prepareWallet("Importador", buyer, { usdc: true });
await prepareWallet("Verificador", verifier, { verifier: true });

await must("Whisp (FAO): riesgo de deforestación por parcela", async () => {
  const sq = (lng, lat, d = 0.006) => ({ type: "Polygon", coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]] });
  const r = await post("/api/whisp", {
    parcels: [
      { id: "P-01", geometry: sq(-78.85, -5.62) },
      { id: "P-02", geometry: sq(-78.84, -5.61) },
      { id: "P-05", geometry: sq(-79.1, -5.64) },
    ],
  });
  if (r.status !== 200) throw new Error(`${r.status} ${r.json.message ?? JSON.stringify(r.json).slice(0, 200)}`);
  return JSON.stringify(r.json.risks);
});

await must("LotPassport.create_lot firmado por la cooperativa", async () => {
  const root = sha(`${lotId}:credenciales`);
  const tx = await invoke(coop, "create_lot", [
    nativeToScVal(coop.publicKey(), { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    xdr.ScVal.scvBytes(Buffer.from(root, "hex")),
    nativeToScVal(4, { type: "u32" }),
    nativeToScVal(60, { type: "u32" }),
  ]);
  return `tx ${tx}`;
});

let contractId;
await must(`Escrow Trustless Work: deploy de ${AMOUNT} USDC (firma el importador)`, async () => {
  const d = await post("/api/escrow", { action: "deploy", signer: buyer.publicKey(), lotId, asset: "USDC", amount: AMOUNT });
  if (d.status !== 200) throw new Error(`${d.status} ${JSON.stringify(d.json).slice(0, 300)}`);
  const s = await post("/api/escrow", { action: "submit", signedXdr: sign(d.json.unsignedXdr, buyer) });
  if (s.status !== 200) throw new Error(`${s.status} ${JSON.stringify(s.json).slice(0, 300)}`);
  contractId = s.json.contractId ?? d.json.contractId;
  if (!contractId) throw new Error("sin contractId");
  return contractId;
});

await must("Escrow: fondeo", async () => {
  const f = await post("/api/escrow", { action: "fund", contractId, signer: buyer.publicKey(), amount: AMOUNT });
  if (f.status !== 200) throw new Error(`${f.status} ${JSON.stringify(f.json).slice(0, 300)}`);
  const s = await post("/api/escrow", { action: "submit", signedXdr: sign(f.json.unsignedXdr, buyer) });
  if (s.status !== 200) throw new Error(`${s.status} ${JSON.stringify(s.json).slice(0, 300)}`);
  return `tx ${s.json.txHash}`;
});

await must("Regla: liberar sin credencial → 409", async () => {
  const r = await post("/api/escrow/release", { contractId, lotId, milestone: "acopio" });
  if (r.status !== 409) throw new Error(`esperaba 409, llegó ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.code;
});

await must("Regla: escrow de otro lote → 409", async () => {
  const r = await post("/api/escrow/release", { contractId, lotId: `${lotId}-OTRO`, milestone: "acopio" });
  if (r.status !== 409) throw new Error(`esperaba 409, llegó ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.code;
});

for (const m of MILESTONES) {
  await must(`Verificador firma ${m}`, async () => {
    const tx = await invoke(verifier, "attest", [
      nativeToScVal(verifier.publicKey(), { type: "address" }),
      nativeToScVal(lotId, { type: "string" }),
      milestoneVal(m),
      xdr.ScVal.scvBytes(Buffer.from(sha(`${lotId}:${m}:evidencia`), "hex")),
    ]);
    return `tx ${tx}`;
  });
  await must(`Liberación de ${m}`, async () => {
    const r = await post("/api/escrow/release", { contractId, lotId, milestone: m });
    if (r.status !== 200) throw new Error(`${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    return `tx ${r.json.releaseTx}`;
  });
}

await must("La cooperativa recibió el pago", async () => {
  const st = await post("/api/testnet", { action: "status", address: coop.publicKey() });
  const h = await fetch(`https://horizon-testnet.stellar.org/accounts/${coop.publicKey()}`).then((r) => r.json());
  const usdc = h.balances?.find((b) => b.asset_code === "USDC");
  return `USDC ${usdc?.balance ?? "sin trustline"} · XLM ${Number(st.json.xlm).toFixed(1)}`;
});

await must("Pasaporte público leído de la cadena", async () => {
  const r = await fetch(`${BASE}/api/lote/${lotId}`);
  const j = await r.json();
  if (r.status !== 200) throw new Error(`${r.status} ${j.message}`);
  return `${j.parcels} parcelas · ${j.bags} sacos · ${j.attestations.length}/3 hitos`;
});

summary();
