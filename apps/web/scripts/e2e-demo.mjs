// Recorre la demo guiada (/api/demo) como lo haría una persona con UNA sola wallet.
// Por cada rol crea una cuenta nueva en memoria, la prepara y recorre los 12 pasos:
// las firmas del rol las hace esa cuenta; el resto lo firman las cuentas de la casa.
// Uso: node scripts/e2e-demo.mjs http://localhost:3000 [cooperativa|importador|verificador ...]
// No imprime secretos.
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

const args = process.argv.slice(2);
const BASE = new URL(args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").origin;
const ROLES = args.filter((a) => !a.startsWith("http"));
const MILESTONES = ["acopio", "embarque", "llegada"];
let failures = 0;

async function call(body) {
  const res = await fetch(`${BASE}/api/demo`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.message ?? `HTTP ${res.status}`), { status: res.status });
  return json;
}

async function signed(kp, result) {
  if (result.signer !== "user") return result;
  const tx = TransactionBuilder.fromXDR(result.unsignedXdr, Networks.TESTNET);
  tx.sign(kp);
  return call({ action: "submit", kind: result.kind, signedXdr: tx.toXDR() });
}

async function run(role, acta) {
  const kp = Keypair.random();
  const base = { role, address: kp.publicKey() };
  const state = {};
  const step = async (name, fn) => {
    try {
      const detail = await fn();
      console.log(`OK   [${role}] ${name}${detail ? ` · ${detail}` : ""}`);
    } catch (err) {
      failures++;
      console.log(`FAIL [${role}] ${name} · ${err.message}`);
      throw err;
    }
  };
  await step("Preparar la wallet del usuario", async () => {
    const r = await call({ action: "prepare", ...base });
    await signed(kp, r);
    return r.signer === "user" ? "1 firma" : "sin firmas";
  });
  await step("Whisp (FAO)", async () => {
    const r = await call({ action: "start", ...base });
    Object.assign(state, { lotId: r.lotId, risks: r.risks });
    return `${r.lotId} · fuente ${r.source}`;
  });
  if (acta) {
    await step("ACTA: credencial del lote", async () => {
      const r = await call({ action: "credential", ...base, lotId: state.lotId, risks: state.risks });
      if (r.status !== "valid") throw new Error(`estado ${r.status}`);
      return `${r.vcId} · tx ${r.txId}`;
    });
  }
  await step("LotPassport.create_lot", async () => (await signed(kp, await call({ action: "anchor", ...base, lotId: state.lotId, risks: state.risks }))).hash);
  await step("Escrow: deploy", async () => {
    const r = await signed(kp, await call({ action: "escrow-deploy", ...base, lotId: state.lotId }));
    state.contractId = r.contractId;
    if (!state.contractId) throw new Error("sin contractId");
    return state.contractId;
  });
  await step("Escrow: fondeo", async () => (await signed(kp, await call({ action: "escrow-fund", ...base, lotId: state.lotId, contractId: state.contractId }))).hash);
  await step("Liberar sin prueba → 409", async () => {
    try {
      await call({ action: "release", ...base, lotId: state.lotId, contractId: state.contractId, milestone: "acopio" });
    } catch (err) {
      if (err.status === 409) return "rechazado";
      throw err;
    }
    throw new Error("se liberó sin atestación");
  });
  for (const m of MILESTONES) {
    await step(`Atestar ${m}`, async () => (await signed(kp, await call({ action: "attest", ...base, lotId: state.lotId, milestone: m }))).hash);
    await step(`Liberar ${m}`, async () => (await call({ action: "release", ...base, lotId: state.lotId, contractId: state.contractId, milestone: m })).hash);
  }
  await step("Pasaporte público", async () => {
    const r = await fetch(`${BASE}/api/lote/${state.lotId}`).then((x) => x.json());
    if (r.attestations?.length !== 3) throw new Error(`atestaciones ${r.attestations?.length}`);
    return `${r.parcels} parcelas · ${r.bags} sacos · 3/3 hitos`;
  });
}

const status = await call({ action: "status" });
console.log(`Cuentas de la casa: ${Object.entries(status.house).map(([r, a]) => `${r}=${a ? "sí" : "no"}`).join(" ")} · ACTA=${status.acta ? "sí" : "no"}\n`);
for (const role of ROLES.length ? ROLES : ["cooperativa", "importador", "verificador"]) {
  await run(role, status.acta).catch(() => {});
}
console.log(failures ? `\n${failures} paso(s) fallaron` : "\nTodos los pasos OK");
process.exit(failures ? 1 : 0);
