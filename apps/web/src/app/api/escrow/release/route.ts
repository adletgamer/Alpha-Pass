// Regla central en Testnet: aprobar y liberar un hito SOLO si LotPassport
// confirma en la cadena que el hito está atestado. La cuenta aprobadora de
// Alpha Pass firma en el servidor; su secreto nunca sale de aquí.
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import { escrowEngagementId, isAttestedOnChain, signWithApprover } from "@/lib/server/stellar";
import { MILESTONES, type Milestone } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { contractId, lotId, milestone } = (await request.json()) as {
      contractId: string; lotId: string; milestone: Milestone;
    };
    const index = MILESTONES.indexOf(milestone);
    if (index < 0 || !contractId || !lotId) {
      return Response.json({ code: "invalid", message: "Faltan datos del hito" }, { status: 400 });
    }
    // El escrow debe pertenecer a este lote: sin esto, un lote atestado podría
    // liberar el escrow de otro lote (la cuenta aprobadora es la misma para todos).
    if ((await escrowEngagementId(contractId)) !== lotId) {
      return Response.json(
        { code: "escrow_ajeno", message: "Ese escrow no corresponde a este lote: no se libera." },
        { status: 409 },
      );
    }
    if (!(await isAttestedOnChain(lotId, milestone))) {
      return Response.json(
        { code: "falta_atestacion", message: "LotPassport no tiene la credencial de este hito: no se libera." },
        { status: 409 },
      );
    }
    const approver = serverEnv.roles().approver;
    const approve = await TW.approve({ contractId, approver, milestoneIndexes: [index] });
    const approved = await TW.send(signWithApprover(approve.unsignedXdr));
    const release = await TW.release({ contractId, releaseSigner: approver, milestoneIndexes: [index] });
    const released = await TW.send(signWithApprover(release.unsignedXdr));
    return Response.json({ approveTx: approved.txHash, releaseTx: released.txHash });
  } catch (err) {
    if (err instanceof TrustlessWorkError) return Response.json(err.body, { status: err.status });
    return errorResponse(err);
  }
}
