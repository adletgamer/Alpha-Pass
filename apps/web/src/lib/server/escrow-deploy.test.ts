import { describe, expect, it } from "vitest";
import { buildEscrowDeploy } from "./escrow-deploy";

const buyer = `G${"A".repeat(55)}`;
const cooperative = `G${"B".repeat(55)}`;
const input = {
  signer: buyer,
  lotId: "2026-JAE-014",
  asset: "EURC" as const,
  amount: 16500,
  receiver: cooperative,
  issuer: `G${"C".repeat(55)}`,
  roles: { approver: buyer, admin: buyer, disputeResolver: buyer, platform: buyer },
};

describe("escrow recipient", () => {
  it("pays every milestone to the cooperative and sums to the total", () => {
    const deploy = buildEscrowDeploy(input);
    expect(deploy.roles.serviceProviders).toEqual([cooperative]);
    expect(deploy.milestones.map((m) => m.receiver)).toEqual([cooperative, cooperative, cooperative]);
    expect(deploy.milestones.reduce((sum, m) => sum + m.amount, 0)).toBe(16500);
  });

  it("rejects a buyer as recipient", () => {
    expect(() => buildEscrowDeploy({ ...input, receiver: buyer })).toThrow();
  });
});
