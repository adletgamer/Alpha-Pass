import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { OPERATION_ROLES, type Checkpoint } from "@/lib/operation";
import { accessHash, applyCheckpoint, OperationError, type AccessHashes } from "@/lib/server/operation-state";
import { createOperation, operationsConfigured, updateOperation } from "@/lib/server/operations-db";
import { authorizedOperation, operationView, transactionState } from "@/lib/server/operations";
import { isAttestedOnChain, readEscrowMilestones } from "@/lib/server/stellar";
import { verifiedIntent } from "@/lib/server/operation-intent";
import { buildLotEvidence } from "@/lib/lot-evidence";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (process.env.NEXT_PUBLIC_ALPHA_MODE !== "testnet" || serverEnv.network !== "testnet") {
      throw new OperationError("La operación compartida está disponible en Stellar Testnet.", 403);
    }
    if (!operationsConfigured()) return Response.json({ message: "La operación compartida todavía no tiene una base de datos configurada." }, { status: 503 });
    const body = await request.json();
    const id = body.lotId;
    if (typeof id !== "string" || !/^2026-JAE-014-[A-Z0-9]{4,16}$/.test(id)) {
      throw new OperationError("ID de lote de prueba inválido.", 400);
    }
    if (body.action === "create") {
      if (typeof body.cooperative !== "string" || !/^G[A-Z2-7]{55}$/.test(body.cooperative)) {
        throw new OperationError("Conecta la wallet de la cooperativa.", 400);
      }
      if (!OPERATION_ROLES.every((role) => typeof body.keys?.[role] === "string" && /^[a-f0-9]{64}$/.test(body.keys[role]))) {
        throw new OperationError("Códigos de acceso inválidos.", 400);
      }
      const hashes = Object.fromEntries(OPERATION_ROLES.map((role) => [role, accessHash(body.keys[role])])) as AccessHashes;
      if (new Set(Object.values(hashes)).size !== OPERATION_ROLES.length) {
        throw new OperationError("Cada rol requiere un enlace distinto.", 400);
      }
      await createOperation(id, body.cooperative, hashes, {});
    }
    const key = request.headers.get("x-operation-access");
    if (body.action === "checkpoint") {
      const checkpoint = body.checkpoint as Checkpoint;
      if (checkpoint?.type === "risks") throw new OperationError("La evaluación debe venir de Whisp.", 403);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { row, role } = await authorizedOperation(id, key);
        const escrow = row.state.escrow;
        const prior = checkpoint?.type === "deploy"
          ? await transactionState(escrow?.deployHash, escrow?.deployExpires)
          : checkpoint?.type === "fund"
            ? await transactionState(escrow?.fundHash, escrow?.fundExpires)
            : checkpoint?.type === "anchor"
              ? await transactionState(row.state.anchorHash, row.state.anchorExpires)
              : null;
        const state = applyCheckpoint(row.state, role, checkpoint, () => prior?.state === "replaceable");
        if (checkpoint.type === "deploy") {
          const { buyer, asset, amount, deployHash, deployExpires } = checkpoint.escrow;
          if (!verifiedIntent({ lotId: id, action: "deploy", signer: buyer, asset, amount, hash: deployHash!, expires: deployExpires! }, checkpoint.ticket)) {
            throw new OperationError("La creación no coincide con la transacción preparada.", 400);
          }
        }
        if (checkpoint.type === "fund" && escrow) {
          if (!verifiedIntent({ lotId: id, action: "fund", signer: escrow.buyer, asset: escrow.asset, amount: escrow.amount, contractId: escrow.contractId,
            hash: checkpoint.hash, expires: checkpoint.expires }, checkpoint.ticket)) {
            throw new OperationError("El fondeo no coincide con la transacción preparada.", 400);
          }
        }
        if (checkpoint.type === "deployed") {
          if (escrow?.contractId !== checkpoint.contractId) {
            const deploy = await transactionState(escrow?.deployHash);
            if (deploy.state !== "confirmed" || deploy.value !== checkpoint.contractId) {
              throw new OperationError("El contrato todavía no está vinculado a la creación confirmada.");
            }
            await readEscrowMilestones(checkpoint.contractId, id);
          }
        }
        if (checkpoint.type === "attested" &&
          (!(await isAttestedOnChain(id, checkpoint.milestone)) || (await transactionState(checkpoint.hash)).state !== "confirmed")) {
          throw new OperationError("La atestación todavía no está confirmada.");
        }
        if (await updateOperation(row, state)) return Response.json({ saved: true });
      }
      throw new OperationError("La operación cambió mientras guardabas. Actualiza y vuelve a intentarlo.");
    }
    if (!["read", "create", "evidence"].includes(body.action)) throw new OperationError("Acción desconocida.", 400);
    const { row, role } = await authorizedOperation(id, key);
    if (body.action === "evidence" && role !== "importador") throw new OperationError("Abre el enlace del importador para exportar el expediente.", 403);
    const view = await operationView(row, role);
    if (body.action === "evidence") {
      if (!view.lot.passportRoot) throw new OperationError("El expediente se habilita cuando se confirma el anclaje.", 409);
      const evidence = await buildLotEvidence(
        view.lot,
        { type: "stellar-testnet", contractId: serverEnv.lotPassportId() },
        view.progress.releaseHashes,
      );
      if (!evidence) throw new OperationError("La evidencia disponible no coincide con la raíz del pasaporte.", 409);
      return Response.json(evidence, { headers: { "Cache-Control": "private, no-store" } });
    }
    const projected = view.progress.escrow;
    if (projected?.contractId && (!row.state.escrow?.contractId ||
      (projected.fundConfirmed && !row.state.escrow.fundConfirmed))) {
      await updateOperation(row, view.progress);
    }
    return Response.json(view, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OperationError) return Response.json({ message: error.message }, { status: error.status });
    return errorResponse(error);
  }
}
