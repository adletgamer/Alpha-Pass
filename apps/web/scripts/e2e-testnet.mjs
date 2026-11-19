// Prueba de punta a punta en Stellar Testnet contra la app corriendo (pnpm dev / start).
// Crea cuentas nuevas (cooperativa, importador, verificador), las prepara con las mismas
// rutas que usa /probar y recorre: Whisp → LotPassport → escrow → 3 hitos → pasaporte público.
// Uso: node scripts/e2e-testnet.mjs http://localhost:3150 [--shared]
// No imprime secretos: las claves de prueba se generan en memoria y se descartan.
import { Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const args = process.argv.slice(2);
const SHARED = args.includes("--shared");
const BASE = new URL(args.find((arg) => !arg.startsWith("--")) ?? "http://localhost:3150").origin;
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

async function post(path, body, access) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (access) headers.set("x-operation-access", access);
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function successful(response) {
  if (response.status !== 200) throw new Error(`HTTP ${response.status} · ${response.json.message ?? response.json.code ?? "respuesta inesperada"}`);
  return response.json;
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

async function invoke(kp, method, args, beforeSubmit) {
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(PASSPORT).call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  if (beforeSubmit) await beforeSubmit({ hash: prepared.hash().toString("hex"), expires: Number(prepared.timeBounds.maxTime) });
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

async function prepareReceiver(kp) {
  const address = kp.publicKey();
  await prepareWallet("Cooperativa", kp);
  await must("Cooperativa: recepción de USDC", async () => {
    const state = successful(await post("/api/testnet", { action: "status", address }));
    if (state.hasUsdcTrustline) return "trustline disponible";
    const prepared = successful(await post("/api/testnet", { action: "trustline", address }));
    const sent = successful(await post("/api/testnet", { action: "submit", signedXdr: sign(prepared.unsignedXdr, kp) }));
    return `tx ${sent.hash}`;
  });
  return Number(successful(await post("/api/testnet", { action: "status", address })).usdc);
}

function summary() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} pasos OK`);
}

function cooperativeWallet() {
  if (!SHARED) return Keypair.random();
  const secret = process.env.E2E_ACTA_ISSUER_SECRET;
  if (!secret) throw new Error("--shared requiere E2E_ACTA_ISSUER_SECRET de la wallet Testnet vinculada a ACTA_API_KEY.");
  try {
    return Keypair.fromSecret(secret);
  } catch {
    throw new Error("E2E_ACTA_ISSUER_SECRET no corresponde a una wallet Stellar válida.");
  }
}

const coop = cooperativeWallet();
const buyer = Keypair.random();
const verifier = Keypair.random();
const lotId = `2026-JAE-014-E2E${randomBytes(4).toString("hex").toUpperCase()}`;
const roles = ["cooperativa", "importador", "verificador"];
const keys = Object.fromEntries(roles.map((role) => [role, randomBytes(32).toString("hex")]));
const importerAccess = SHARED ? keys.importador : undefined;
const escrowContext = SHARED ? { lotId } : {};

async function operation(role, body) {
  return successful(await post("/api/operations", { lotId, ...body }, keys[role]));
}

const readOperation = (role) => operation(role, { action: "read" });
const checkpoint = (role, step) => operation(role, { action: "checkpoint", checkpoint: step });

async function submitEscrow(action, prepared, extra = {}) {
  const signedXdr = sign(prepared.unsignedXdr, buyer);
  if (SHARED) {
    const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    const hash = tx.hash().toString("hex");
    const expires = Number(tx.timeBounds?.maxTime ?? 0);
    const step = action === "deploy"
      ? { type: "deploy", escrow: { ...extra, deployHash: hash, deployExpires: expires } }
      : { type: "fund", hash, expires };
    await checkpoint("importador", { ...step, ticket: prepared.ticket });
  }
  return successful(await post("/api/escrow", { action: "submit", signedXdr, ...escrowContext }, importerAccess));
}

console.log(`Lote ${lotId}\n`);

let acta;
let actaConfig;
if (SHARED) {
  await must("Configuración de ACTA y operación compartida en Testnet", async () => {
    const { ActaClient } = await import("@acta-team/credentials");
    acta = new ActaClient(`${BASE}/api/acta`, "proxy", { allowEphemeralStorage: true });
    actaConfig = await acta.getConfig();
    assert.equal(actaConfig.networkPassphrase, Networks.TESTNET, "ACTA debe apuntar a Stellar Testnet");
    const created = await operation("cooperativa", { action: "create", keys, cooperative: coop.publicKey() });
    assert.equal(created.role, "cooperativa");
    for (const role of roles) assert.equal((await readOperation(role)).role, role);
    assert.equal((await post("/api/operations", { action: "read", lotId })).status, 403);
    return "tres enlaces independientes";
  });
}

let startingUsdc = 200;
if (SHARED) startingUsdc = await prepareReceiver(coop);
else await prepareWallet("Cooperativa", coop, { usdc: true });
await prepareWallet("Importador", buyer, { usdc: true });
await prepareWallet("Verificador", verifier, { verifier: true });

let root = sha(`${lotId}:credenciales`);
let parcelCount = 4;
let bags = 60;
let checkedLot;
let eligible;
await must("Whisp (FAO): riesgo de deforestación por parcela", async () => {
  if (SHARED) {
    const body = { lotId };
    assert.equal((await post("/api/whisp", body, keys.importador)).status, 403);
    const assessment = successful(await post("/api/whisp", body, keys.cooperativa));
    checkedLot = (await readOperation("importador")).lot;
    assert.equal(checkedLot.parcels.length, 5);
    for (const parcel of checkedLot.parcels) {
      assert.ok(["alerta", "sin_riesgo"].includes(parcel.risk), parcel.id);
      assert.equal(parcel.risk, assessment.risks[parcel.id]);
    }
    eligible = checkedLot.parcels.filter((p) => p.risk === "sin_riesgo");
    assert.ok(eligible.length > 0, "El lote de prueba necesita al menos una parcela apta");
    const { passportRoot } = await import("../src/lib/merkle.ts");
    root = await passportRoot(checkedLot, eligible);
    parcelCount = eligible.length;
    bags = eligible.reduce((total, p) => total + p.bags, 0);
    return `${parcelCount} aptas de ${checkedLot.parcels.length}`;
  }
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

if (SHARED) {
  await must("ACTA: emitir y recuperar la credencial exacta antes del anclaje", async () => {
    const owner = coop.publicKey();
    const signTransaction = (unsigned, { networkPassphrase }) => {
      assert.equal(networkPassphrase, Networks.TESTNET, "ACTA devolvió una transacción fuera de Testnet");
      return Promise.resolve(sign(unsigned, coop));
    };
    const { did } = await acta.getOrCreateIssuerIdentity({ controller: owner, signTransaction });
    try {
      const vault = await acta.vaultCreate({ owner, didUri: did, sourcePublicKey: owner, contractId: actaConfig.actaContractId });
      const created = await acta.vaultCreate({ signedXdr: await signTransaction(vault.xdr, { networkPassphrase: vault.network }) });
      assert.ok(created.tx_id, "ACTA no devolvió el hash de creación de la bóveda");
    } catch (error) {
      if (!(error instanceof Error) || !/exists|already initialized/i.test(error.message)) throw error;
    }
    const vcId = `alpha-pass-${lotId}`;
    const issue = await acta.vcIssue({
      owner, vcId, issuer: owner, issuerDid: did, sourcePublicKey: owner, contractId: actaConfig.actaContractId,
      vcData: JSON.stringify({
        "@context": ["https://www.w3.org/ns/credentials/v2", "https://www.w3.org/ns/credentials/examples/v2"],
        type: ["VerifiableCredential", "AlphaPassLotPassport"],
        credentialSubject: {
          id: `urn:alpha-pass:lot:${lotId}`, cooperative: checkedLot.cooperative, passportRoot: root,
          parcels: eligible.map(({ id, bags, risk }) => ({ id, bags, risk })), deforestationCheck: "Whisp (FAO)",
        },
      }),
    });
    const submitted = await acta.vcIssue({ signedXdr: await signTransaction(issue.xdr, { networkPassphrase: issue.network }) });
    assert.match(submitted.tx_id ?? "", /^[a-f0-9]{64}$/i);
    assert.equal((await acta.vaultVerify({ owner, vcId })).status, "valid");
    const envelope = await acta.vaultGetVcDirect({ owner, vcId });
    const raw = envelope.vc ?? envelope.result;
    const credential = typeof raw === "string" ? JSON.parse(raw) : raw;
    assert.equal(credential?.credentialSubject?.id, `urn:alpha-pass:lot:${lotId}`);
    assert.equal(credential.credentialSubject.passportRoot, root);
    await checkpoint("cooperativa", { type: "credential", credential: { id: vcId, txHash: submitted.tx_id, root } });
    const resumed = await readOperation("cooperativa");
    assert.equal(resumed.progress.credential.id, vcId);
    assert.equal(resumed.lot.passportRoot, undefined);
    return `tx ${submitted.tx_id}`;
  });
}

await must("LotPassport.create_lot firmado por la cooperativa", async () => {
  const tx = await invoke(coop, "create_lot", [
    nativeToScVal(coop.publicKey(), { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    xdr.ScVal.scvBytes(Buffer.from(root, "hex")),
    nativeToScVal(parcelCount, { type: "u32" }),
    nativeToScVal(bags, { type: "u32" }),
  ], SHARED ? (receipt) => checkpoint("cooperativa", { type: "anchor", ...receipt }) : undefined);
  if (SHARED) assert.equal((await readOperation("importador")).lot.passportRoot, root);
  return `tx ${tx}`;
});

let contractId;
await must(`Escrow Trustless Work: deploy de ${AMOUNT} USDC (firma el importador)`, async () => {
  const terms = { asset: "USDC", amount: AMOUNT };
  const d = successful(await post("/api/escrow", { action: "deploy", signer: buyer.publicKey(), lotId, ...terms }, importerAccess));
  const s = await submitEscrow("deploy", d, { buyer: buyer.publicKey(), ...terms });
  contractId = SHARED ? (await readOperation("importador")).progress.escrow?.contractId : s.contractId ?? d.contractId;
  if (!contractId) throw new Error("sin contractId");
  return contractId;
});

await must("Escrow: fondeo", async () => {
  const request = { action: "fund", contractId, signer: buyer.publicKey(), amount: AMOUNT, ...escrowContext };
  let f = successful(await post("/api/escrow", request, importerAccess));
  if (SHARED) {
    const resumed = await readOperation("importador");
    assert.equal(resumed.lot.escrow?.funded, false);
    assert.equal(resumed.progress.escrow?.contractId, contractId);
    f = successful(await post("/api/escrow", request, importerAccess));
  }
  const s = await submitEscrow("fund", f);
  if (SHARED) assert.equal((await readOperation("cooperativa")).lot.escrow?.funded, true);
  return `tx ${s.txHash}`;
});

await must("Regla: liberar sin credencial → 409", async () => {
  const r = await post("/api/escrow/release", { contractId, lotId, milestone: "acopio" }, importerAccess);
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
    if (SHARED) await checkpoint("verificador", { type: "attested", milestone: m, hash: tx });
    return `tx ${tx}`;
  });
  await must(`Liberación de ${m}`, async () => {
    const body = { contractId, lotId, milestone: m };
    const r = successful(await post("/api/escrow/release", body, importerAccess));
    if (SHARED) {
      assert.equal((await readOperation("cooperativa")).lot.escrow?.released[m], true);
      const retry = successful(await post("/api/escrow/release", body, importerAccess));
      assert.equal(retry.alreadyReleased, true);
      assert.equal(retry.releaseTx, r.releaseTx);
    }
    return `tx ${r.releaseTx}`;
  });
}

await must("La cooperativa recibió el pago", async () => {
  const st = await post("/api/testnet", { action: "status", address: coop.publicKey() });
  const h = await fetch(`https://horizon-testnet.stellar.org/accounts/${coop.publicKey()}`).then((r) => r.json());
  const usdc = h.balances?.find((b) => b.asset_code === "USDC");
  const received = Number(usdc?.balance) - startingUsdc;
  assert.ok(received > 0 && received <= AMOUNT, "El saldo de la cooperativa debe aumentar por el pago de prueba");
  return `Recibió ${received.toFixed(2)} USDC de prueba · XLM ${Number(st.json.xlm).toFixed(1)}`;
});

await must("Pasaporte público leído de la cadena", async () => {
  const r = await fetch(`${BASE}/api/lote/${lotId}`);
  const j = await r.json();
  if (r.status !== 200) throw new Error(`${r.status} ${j.message}`);
  assert.equal(j.parcels, parcelCount);
  assert.equal(j.bags, bags);
  assert.equal(j.passportRoot, root);
  assert.equal(j.attestations.length, MILESTONES.length);
  return `${j.parcels} parcelas · ${j.bags} sacos · ${j.attestations.length}/3 hitos`;
});

summary();
