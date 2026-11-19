import { describe, expect, it, vi } from "vitest";
import { initialLot } from "./sample-data";
import { resumeEscrow } from "./escrow-recovery";
import type { SharedOperation, Checkpoint } from "./operation";

const buyer = "G" + "A".repeat(55);
const contractId = "C" + "B".repeat(55);
const lot = initialLot("2026-JAE-014-TEST");
const input = { buyer, asset: "USDC" as const, amount: 150 };
const blank: SharedOperation = {
  lot,
  cooperative: "G" + "B".repeat(55),
  role: "importador",
  progress: {},
  pendingAnchor: false,
  pendingDeploy: false,
  pendingFund: false,
};

function setup() {
  const calls: string[] = [];
  const io = {
    prepare: vi.fn(async (body: object) => {
      const action = (body as { action: string }).action;
      calls.push(`prepare:${action}`);
      return { unsignedXdr: action, ticket: action };
    }),
    sign: vi.fn(async (unsigned: string) => {
      calls.push(`sign:${unsigned}`);
      return { signed: unsigned, hash: unsigned, expires: 12345 };
    }),
    submit: vi.fn(async (signed: string) => {
      calls.push(`submit:${signed}`);
      return { contractId };
    }),
    checkpoint: vi.fn(async (step: Checkpoint) => { calls.push(`saved:${step.type}`); }),
    refresh: vi.fn(async () => blank),
  };
  return { calls, io };
}

describe("recuperación del escrow con una wallet", () => {
  it("guarda los hashes antes de enviar ambas transacciones", async () => {
    const { calls, io } = setup();
    await resumeEscrow(blank, input, io);
    expect(calls).toEqual([
      "prepare:deploy", "sign:deploy", "saved:deploy", "submit:deploy",
      "saved:deployed", "prepare:fund", "sign:fund", "saved:fund", "submit:fund",
    ]);
  });

  it("retoma el fondeo si la segunda firma se cancela", async () => {
    const { io } = setup();
    const sign = io.sign.getMockImplementation()!;
    io.sign.mockImplementation(async (step) => {
      if (step === "fund") throw new Error("Firma cancelada");
      return sign(step);
    });
    await expect(resumeEscrow(blank, input, io)).rejects.toThrow("Firma cancelada");
    expect(io.checkpoint).toHaveBeenCalledWith({ type: "deployed", contractId });
    const retry = setup();
    await resumeEscrow({ ...blank, progress: { escrow: { ...input, contractId } } }, input, retry.io);
    expect(retry.calls).toEqual(["saved:deployed", "prepare:fund", "sign:fund", "saved:fund", "submit:fund"]);
  });

  it("evita una segunda transacción si se pierde la respuesta", async () => {
    const { io } = setup();
    await expect(resumeEscrow({ ...blank, pendingFund: true }, input, io)).rejects.toThrow("fondeo ya se envió");
    await expect(resumeEscrow({ ...blank, pendingDeploy: true }, input, io)).rejects.toThrow("creación ya se envió");
    expect(io.prepare).not.toHaveBeenCalled();
  });

  it("rechaza una cuenta distinta al retomar el escrow", async () => {
    const { io } = setup();
    await expect(resumeEscrow({ ...blank, progress: { escrow: { ...input, contractId } } }, { ...input, buyer: "otra" }, io)).rejects.toThrow("cuenta del importador");
    expect(io.prepare).not.toHaveBeenCalled();
  });
});
