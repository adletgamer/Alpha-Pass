import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/escrow/release/route";

const mock = vi.hoisted(() => ({
  attested: vi.fn(),
  flags: vi.fn(),
  approve: vi.fn(),
  release: vi.fn(),
  send: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./operations-db", () => ({ operationsConfigured: () => false }));
vi.mock("./operations", () => ({}));
vi.mock("./stellar", () => ({
  escrowEngagementId: async () => "2026-JAE-014-TEST",
  isAttestedOnChain: mock.attested,
  readEscrowMilestones: mock.flags,
  signWithApprover: (xdr: string) => xdr,
}));
vi.mock("./trustless-work", () => ({
  TrustlessWorkError: class extends Error {},
  TW: { approve: mock.approve, release: mock.release, send: mock.send },
}));

function release(milestone: string) {
  return POST(new Request("https://alpha.example/api/escrow/release", {
    method: "POST",
    body: JSON.stringify({ lotId: "2026-JAE-014-TEST", contractId: "C" + "C".repeat(55), milestone }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const suffix of ["APPROVER_SECRET", "APPROVER_PUBLIC", "ADMIN_PUBLIC", "DISPUTE_RESOLVER_PUBLIC", "PLATFORM_PUBLIC"]) {
    vi.stubEnv(`ALPHA_${suffix}`, "fixture");
  }
  mock.attested.mockResolvedValue(true);
  mock.flags.mockResolvedValue(Array.from({ length: 3 }, () => ({ approved: false, released: false })));
  mock.approve.mockResolvedValue({ unsignedXdr: "approve" });
  mock.release.mockResolvedValue({ unsignedXdr: "release" });
  mock.send.mockImplementation(async (step: string) => ({ txHash: step }));
});

describe("liberación recuperable", () => {
  it("bloquea el pago cuando LotPassport no confirma la prueba", async () => {
    mock.attested.mockResolvedValue(false);
    expect((await release("acopio")).status).toBe(409);
    expect(mock.approve).not.toHaveBeenCalled();
  });

  it("salta la aprobación si se confirmó en el intento anterior", async () => {
    mock.flags.mockResolvedValue([{ approved: true, released: false }, {}, {}]);
    const response = await release("acopio");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ approveTx: null, releaseTx: "release" });
    expect(mock.approve).not.toHaveBeenCalled();
    expect(mock.send).toHaveBeenCalledTimes(1);
  });

  it("reconoce un pago confirmado aunque se haya perdido la respuesta", async () => {
    mock.flags.mockResolvedValue([{ approved: true, released: true }, {}, {}]);
    expect(await (await release("acopio")).json()).toMatchObject({ alreadyReleased: true });
    expect(mock.send).not.toHaveBeenCalled();
  });

  it("no paga el embarque con el acopio pendiente", async () => {
    expect((await release("embarque")).status).toBe(409);
    expect(mock.send).not.toHaveBeenCalled();
  });
});
