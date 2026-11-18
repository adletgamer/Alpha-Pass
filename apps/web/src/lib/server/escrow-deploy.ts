import { MILESTONES, MILESTONE_LABEL, type AssetCode } from "../domain";
import { milestoneAmount } from "../release-gate";

interface Roles {
  approver: string;
  admin: string;
  disputeResolver: string;
  platform: string;
}

export function buildEscrowDeploy(input: {
  signer: string;
  lotId: string;
  asset: AssetCode;
  amount: number;
  receiver: string;
  issuer: string;
  roles: Roles;
}) {
  const { signer, lotId, asset, amount, receiver, issuer, roles } = input;
  if (!/^G[A-Z2-7]{55}$/.test(receiver) || !/^G[A-Z2-7]{55}$/.test(signer)) {
    throw new Error("La dirección Stellar del comprador o de la cooperativa es inválida.");
  }
  if (receiver === signer) {
    throw new Error("El comprador y la cooperativa no pueden compartir la wallet receptora.");
  }
  return {
    signer,
    engagementId: lotId,
    title: `Alpha Pass · lote ${lotId}`,
    description: `Pago por hitos del lote ${lotId}; cada hito se libera contra su credencial en LotPassport.`,
    platformFee: 0,
    roles: {
      approvers: [roles.approver],
      serviceProviders: [receiver],
      releaseSigners: [roles.approver],
      disputeResolvers: [roles.disputeResolver],
      admin: roles.admin,
      platform: roles.platform,
    },
    milestones: MILESTONES.map((milestone) => ({
      description: MILESTONE_LABEL[milestone],
      amount: milestoneAmount(amount, milestone),
      receiver,
    })),
    trustline: { symbol: asset, address: issuer },
  };
}
