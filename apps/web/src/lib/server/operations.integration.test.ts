import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { initialLot, RECORDED_RISK, SAMPLE_PARCELS } from "../sample-data";
import { POST } from "@/app/api/operations/route";
import { POST as assess } from "@/app/api/whisp/route";
import { GET as publicPassport } from "@/app/api/lote/[id]/route";
import { readOperation, updateOperation, recordMilestoneReceipt } from "./operations-db";
import { applyCheckpoint } from "./operation-state";
import { readLotOnChain } from "./stellar";
import { passportRoot } from "../merkle";
import { verifyLotEvidence } from "../lot-evidence";

vi.mock("server-only", () => ({}));
vi.mock("./stellar", async (importOriginal) => ({
  ...await importOriginal<typeof import("./stellar")>(),
  readLotOnChain: vi.fn(),
}));

let db: PGlite;
let server: PGLiteSocketServer;

const id = "2026-JAE-014-P3DB";
const address = `G${"A".repeat(55)}`;
const keys = { cooperativa: "a".repeat(64), importador: "b".repeat(64), verificador: "c".repeat(64) };

async function action(key: string, body: object) {
  return POST(new Request("https://alpha.example/api/operations", {
    method: "POST",
    headers: { "content-type": "application/json", "x-operation-access": key },
    body: JSON.stringify({ lotId: id, ...body }),
  }));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL("../../../migrations/001_shared_operations.sql", import.meta.url), "utf8"));
  server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  await server.start();
  vi.stubEnv("DATABASE_URL", `postgres://postgres@${server.getServerConn()}/postgres?sslmode=disable`);
  vi.stubEnv("NEXT_PUBLIC_ALPHA_MODE", "testnet");
});

afterAll(async () => {
  await server?.stop();
  await db?.close();
  vi.unstubAllEnvs();
});

describe("operación compartida con PostgreSQL", () => {
  it("sincroniza el lote entre dos roles y limita sus escrituras", async () => {
    const created = await action(keys.cooperativa, { action: "create", cooperative: address, keys });
    expect(created.status).toBe(200);
    expect((await created.json()).role).toBe("cooperativa");
    const checkpoint = { type: "risks", risks: RECORDED_RISK };
    expect((await action(keys.importador, { action: "checkpoint", checkpoint })).status).toBe(403);
    expect((await action(keys.cooperativa, { action: "checkpoint", checkpoint })).status).toBe(403);
    vi.stubEnv("WHISP_API_URL", "https://whisp.example");
    vi.stubEnv("WHISP_API_KEY", "test-key");
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      code: "analysis_completed",
      data: {
        features: SAMPLE_PARCELS.map(({ id }) => ({
          properties: { external_id: id, risk_pcrop: RECORDED_RISK[id] === "alerta" ? "high" : "low" },
        })),
      },
    }));
    try {
      const checked = await assess(new Request("https://alpha.example/api/whisp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operation-access": keys.cooperativa },
        body: JSON.stringify({ lotId: id }),
      }));
      expect(await checked.json()).toMatchObject({ risks: RECORDED_RISK });
    } finally {
      upstream.mockRestore();
    }
    const importer = await action(keys.importador, { action: "read" });
    const view = await importer.json();
    expect(view.role).toBe("importador");
    expect(view.lot.id).toBe(id);
    expect(view.lot.parcels).toHaveLength(SAMPLE_PARCELS.length);
    expect(view.lot.parcels.find((p: { id: string }) => p.id === "P-05").risk).toBe("alerta");
    expect(JSON.stringify(view)).not.toContain(keys.cooperativa);
    expect((await action("d".repeat(64), { action: "read" })).status).toBe(403);
    expect(importer.headers.get("cache-control")).toBe("private, no-store");
  });

  it("impide escrituras antiguas y conserva recibos concurrentes", async () => {
    const row = (await readOperation(id))!;
    await recordMilestoneReceipt(id, "approvalHashes", "acopio", "a".repeat(64));
    expect(await updateOperation(row, {})).toBe(false);
    await recordMilestoneReceipt(id, "releaseHashes", "acopio", "b".repeat(64));
    const latest = (await readOperation(id))!;
    expect(latest.state.risks).toEqual(RECORDED_RISK);
    expect(latest.state.approvalHashes?.acopio).toBe("a".repeat(64));
    expect(latest.state.releaseHashes?.acopio).toBe("b".repeat(64));
  });

  it("conserva la credencial tras cancelar el anclaje y protege su raíz", () => {
    const credential = { id: "alpha-pass-test", root: "a".repeat(64), txHash: "c".repeat(64) };
    const state = applyCheckpoint({}, "cooperativa", { type: "credential", credential }, () => true);
    expect(() => applyCheckpoint(state, "cooperativa", {
      type: "credential", credential: { ...credential, root: "e".repeat(64) },
    }, () => true)).toThrow("raíz");
    const anchor = applyCheckpoint(state, "cooperativa", { type: "anchor", hash: "b".repeat(64), expires: 123 }, () => true);
    expect(anchor.credential).toEqual(credential);
    expect(() => applyCheckpoint(anchor, "cooperativa", { type: "anchor", hash: "d".repeat(64), expires: 456 }, () => false)).toThrow("pendiente");
  });

  it("sirve las hojas al importador después del anclaje y solo la referencia al público", async () => {
    const contractId = `C${"A".repeat(55)}`;
    vi.stubEnv("NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID", contractId);
    expect((await action(keys.importador, { action: "evidence" })).status).toBe(409);
    for (const key of [keys.cooperativa, keys.verificador, ""]) {
      expect((await action(key, { action: "evidence" })).status).toBe(403);
    }
    const lot = initialLot(id);
    const parcels = lot.parcels.filter((parcel) => RECORDED_RISK[parcel.id] === "sin_riesgo").map((p) => ({ ...p, risk: "sin_riesgo" as const }));
    const root = await passportRoot(lot, parcels);
    const row = (await readOperation(id))!;
    expect(await updateOperation(row, { ...row.state, credential: { id: "fixture", txHash: "", root } })).toBe(true);
    vi.mocked(readLotOnChain).mockResolvedValueOnce({
      lotId: id, cooperative: address, passportRoot: "b".repeat(64), parcels: 4, bags: 60, createdAt: 1795120000, attestations: [],
    });
    expect((await action(keys.importador, { action: "evidence" })).status).toBe(409);
    vi.mocked(readLotOnChain).mockResolvedValue({
      lotId: id, cooperative: address, passportRoot: root, parcels: 4, bags: 60, createdAt: 1795120000, attestations: [],
    });
    const response = await action(keys.importador, { action: "evidence" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const evidence = await response.json();
    expect(JSON.stringify(evidence)).not.toContain(keys.importador);
    expect(JSON.stringify(evidence)).not.toContain("P-05");
    const publicResult = await publicPassport(new Request(`https://alpha.example/api/lote/${id}`), { params: Promise.resolve({ id }) });
    const publicRecord = await publicResult.json();
    expect(publicRecord.contractId).toBe(contractId);
    expect(publicRecord).not.toHaveProperty("claims");
    expect(JSON.stringify(publicRecord)).not.toContain("coordinates");
    expect(await verifyLotEvidence(evidence, {
      lotId: id, root: publicRecord.passportRoot, parcels: publicRecord.parcels, source: { type: "stellar-testnet", contractId },
    })).toBe("matches");
  });
});
