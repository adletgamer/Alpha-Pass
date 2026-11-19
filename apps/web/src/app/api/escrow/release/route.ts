// Regla central en Testnet: aprobar y liberar un hito SOLO si LotPassport
// confirma en la cadena que el hito está atestado. La cuenta aprobadora de
// Alpha Pass firma en el servidor; su secreto nunca sale de aquí.
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import { escrowEngagementId, isAttestedOnChain, readEscrowMilestones, signWithApprover } from "@/lib/server/stellar";
import { MILESTONES, type Milestone } from "@/lib/domain";
import { operationsConfigured, readOperation, recordMilestoneReceipt } from "@/lib/server/operations-db";
import { authorizedOperation, operationView } from "@/lib/server/operations";
import { OperationError } from "@/lib/server/operation-state";

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
    const shared = operationsConfigured() ? await readOperation(lotId) : undefined;
    const access = request.headers.get("x-operation-access");
    if (shared) {
      const { role } = await authorizedOperation(lotId, access);
      if (role !== "importador") throw new OperationError("Abre el enlace del importador para liberar un hito.", 403);
      const view = await operationView(shared, role);
      if (view.lot.escrow?.contractId !== contractId || !view.lot.escrow.funded) {
        throw new OperationError("El escrow de esta operación aún no está confirmado y fondeado.");
      }
    }
    const flags = await readEscrowMilestones(contractId, lotId);
    if (flags[index].released) return Response.json({ releaseTx: shared?.state.releaseHashes?.[milestone] ?? null, alreadyReleased: true });
    if (index > 0 && !flags[index - 1].released) {
      throw new OperationError("Primero debe liberarse el hito anterior.");
    }
    const approver = serverEnv.roles().approver;
    let approved: { txHash: string } | undefined;
    if (!flags[index].approved) {
      const approve = await TW.approve({ contractId, approver, milestoneIndexes: [index] });
      approved = await TW.send(signWithApprover(approve.unsignedXdr));
      if (shared) await recordMilestoneReceipt(lotId, "approvalHashes", milestone, approved.txHash);
    }
    const release = await TW.release({ contractId, releaseSigner: approver, milestoneIndexes: [index] });
    const released = await TW.send(signWithApprover(release.unsignedXdr));
    if (shared) await recordMilestoneReceipt(lotId, "releaseHashes", milestone, released.txHash);
    return Response.json({ approveTx: approved?.txHash ?? null, releaseTx: released.txHash });
  } catch (err) {
    if (err instanceof OperationError) return Response.json({ message: err.message }, { status: err.status });
    if (err instanceof TrustlessWorkError) return Response.json(err.body, { status: err.status });
    return errorResponse(err);
  }
}
