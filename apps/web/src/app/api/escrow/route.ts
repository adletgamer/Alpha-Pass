// Construye transacciones del escrow (Trustless Work) que firma la wallet del usuario:
//   action "deploy": el importador crea el escrow de 3 hitos en USDC o EURC
//   action "fund":   el importador deposita el monto
//   action "submit": envía un XDR ya firmado por la wallet
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import type { AssetCode } from "@/lib/domain";
import { cooperativeForLotOnChain } from "@/lib/server/stellar";
import { buildEscrowDeploy } from "@/lib/server/escrow-deploy";

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
        const { signer, lotId, asset, amount } = body as {
          signer: string; lotId: string; asset: AssetCode; amount: number;
        };
        const issuer = ISSUERS[asset];
        if (!issuer) return Response.json({ code: "invalid", message: `Moneda no soportada: ${asset}` }, { status: 400 });
        if (typeof signer !== "string" || typeof lotId !== "string" || !lotId || !Number.isFinite(amount) || amount <= 0) {
          return Response.json({ code: "invalid", message: "Datos inválidos del escrow" }, { status: 400 });
        }
        const receiver = await cooperativeForLotOnChain(lotId);
        const roles = serverEnv.roles();
        const unsigned = await TW.deploy(buildEscrowDeploy({ signer, lotId, asset, amount, receiver, issuer, roles }));
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
