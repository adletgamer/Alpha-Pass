// Construye transacciones del escrow (Trustless Work) que firma la wallet del usuario:
//   action "deploy": el importador crea el escrow de 3 hitos en USDC o EURC
//   action "fund":   el importador deposita el monto
//   action "submit": envía un XDR ya firmado por la wallet
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import type { AssetCode } from "@/lib/domain";
import { cooperativeForLotOnChain, readEscrowMilestones } from "@/lib/server/stellar";
import { buildEscrowDeploy } from "@/lib/server/escrow-deploy";
import { operationsConfigured, readOperation, updateOperation } from "@/lib/server/operations-db";
import { authorizedOperation, transactionState } from "@/lib/server/operations";
import { OperationError } from "@/lib/server/operation-state";
import { sealIntent, transactionIdentity } from "@/lib/server/operation-intent";

const ISSUERS: Record<AssetCode, string | undefined> = {
  USDC: process.env.NEXT_PUBLIC_USDC_ISSUER,
  EURC: process.env.NEXT_PUBLIC_EURC_ISSUER,
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const access = request.headers.get("x-operation-access");
    const shared = operationsConfigured() && typeof body.lotId === "string" ? await readOperation(body.lotId) : undefined;
    if (shared || access) {
      const { role } = await authorizedOperation(body.lotId, access);
      if (role !== "importador") throw new OperationError("Abre el enlace del importador para gestionar el escrow.", 403);
    }
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
        if (shared && receiver !== shared.cooperative) throw new OperationError("La cooperativa del pasaporte no coincide con el lote.");
        if (shared?.state.escrow) {
          const prior = shared.state.escrow;
          if (prior.contractId || prior.buyer !== signer ||
            (await transactionState(prior.deployHash, prior.deployExpires)).state !== "replaceable") {
            throw new OperationError("El lote ya tiene un escrow o una creación pendiente.");
          }
        }
        const roles = serverEnv.roles();
        const unsigned = await TW.deploy(buildEscrowDeploy({ signer, lotId, asset, amount, receiver, issuer, roles }));
        const ticket = shared ? sealIntent({ lotId, action: "deploy", signer, asset, amount, ...transactionIdentity(unsigned.unsignedXdr) }) : undefined;
        return Response.json({ ...unsigned, ticket });
      }
      case "fund": {
        const { contractId, signer, amount } = body;
        const escrow = shared?.state.escrow;
        if (shared && (!escrow || escrow.fundConfirmed || escrow.contractId !== contractId || escrow.buyer !== signer || escrow.amount !== amount ||
          (await transactionState(escrow.fundHash, escrow.fundExpires)).state !== "replaceable")) {
          throw new OperationError("El escrow, el importe o la cuenta no permiten iniciar este fondeo.");
        }
        const unsigned = await TW.fund({ contractId, signer, amount });
        const ticket = escrow ? sealIntent({ lotId: body.lotId, action: "fund", signer, asset: escrow.asset, amount, contractId, ...transactionIdentity(unsigned.unsignedXdr) }) : undefined;
        return Response.json({ ...unsigned, ticket });
      }
      case "submit": {
        if (shared) {
          const { hash } = transactionIdentity(body.signedXdr);
          const escrow = shared.state.escrow;
          if (!escrow || (hash !== escrow.deployHash && hash !== escrow.fundHash)) {
            throw new OperationError("La transacción no está registrada para este lote.", 400);
          }
          const result = await TW.send(body.signedXdr);
          if (hash === escrow.deployHash && result.contractId) {
            await readEscrowMilestones(result.contractId, shared.lot_id);
            for (let attempt = 0; attempt < 3; attempt++) {
              const latest = await readOperation(shared.lot_id);
              if (!latest?.state.escrow || latest.state.escrow.deployHash !== hash || latest.state.escrow.contractId) break;
              if (await updateOperation(latest, { ...latest.state, escrow: { ...latest.state.escrow, contractId: result.contractId } })) break;
            }
          }
          return Response.json(result);
        }
        return Response.json(await TW.send(body.signedXdr));
      }
      default:
        return Response.json({ code: "invalid", message: "Acción desconocida" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof OperationError) return Response.json({ message: err.message }, { status: err.status });
    if (err instanceof TrustlessWorkError) return Response.json(err.body, { status: err.status });
    return errorResponse(err);
  }
}
