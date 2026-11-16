// Construye transacciones del escrow (Trustless Work) que firma la wallet del usuario:
//   action "deploy": el importador crea el escrow de 3 hitos en USDC o EURC
//   action "fund":   el importador deposita el monto
//   action "submit": envía un XDR ya firmado por la wallet
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import { MILESTONES, MILESTONE_LABEL, type AssetCode } from "@/lib/domain";
import { milestoneAmount } from "@/lib/release-gate";

const ISSUERS: Record<AssetCode, string | undefined> = {
  USDC: process.env.NEXT_PUBLIC_USDC_ISSUER,
  EURC: process.env.NEXT_PUBLIC_EURC_ISSUER,
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    switch (body.action) {
      case "deploy": {
        const { signer, lotId, asset, amount, receiver } = body as {
          signer: string; lotId: string; asset: AssetCode; amount: number; receiver: string;
        };
        const issuer = ISSUERS[asset];
        if (!issuer) return Response.json({ code: "invalid", message: `Moneda no soportada: ${asset}` }, { status: 400 });
        const roles = serverEnv.roles();
        const unsigned = await TW.deploy({
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
          milestones: MILESTONES.map((m) => ({
            description: MILESTONE_LABEL[m],
            amount: milestoneAmount(amount, m),
            receiver,
          })),
          trustline: { symbol: asset, address: issuer },
        });
        return Response.json(unsigned);
      }
      case "fund": {
        const { contractId, signer, amount } = body;
        return Response.json(await TW.fund({ contractId, signer, amount }));
      }
      case "submit": {
        return Response.json(await TW.send(body.signedXdr));
      }
      default:
        return Response.json({ code: "invalid", message: "Acción desconocida" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof TrustlessWorkError) return Response.json(err.body, { status: err.status });
    return errorResponse(err);
  }
}
