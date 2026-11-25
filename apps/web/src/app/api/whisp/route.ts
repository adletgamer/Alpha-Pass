// Evaluación de riesgo de deforestación por parcela con la API de Whisp (FAO).
// Documentación: https://whisp.openforis.org/api/openapi.json
import { assertSameOrigin, errorResponse } from "@/lib/server/env";
import { assessWithWhisp, WhispError, type WhispParcel } from "@/lib/server/whisp-assess";
import { authorizedOperation } from "@/lib/server/operations";
import { readOperation, updateOperation } from "@/lib/server/operations-db";
import { applyCheckpoint, OperationError } from "@/lib/server/operation-state";
import { SAMPLE_PARCELS } from "@/lib/sample-data";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { parcels: WhispParcel[]; lotId?: string };
    let parcels = body.parcels;
    const access = request.headers.get("x-operation-access");
    if (access) {
      if (!body.lotId) throw new OperationError("Falta el lote compartido.", 400);
      const { role } = await authorizedOperation(body.lotId, access);
      if (role !== "cooperativa") throw new OperationError("Este enlace no permite verificar las parcelas.", 403);
      parcels = SAMPLE_PARCELS;
    }
    if (!Array.isArray(parcels) || parcels.length === 0 || parcels.length > 200) {
      return Response.json({ code: "invalid", message: "Envía entre 1 y 200 parcelas" }, { status: 400 });
    }
    const { risks, whispVersion } = await assessWithWhisp(parcels);
    if (access && body.lotId) {
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        const row = await readOperation(body.lotId);
        if (!row) throw new OperationError("No se encontró el lote compartido.", 404);
        saved = await updateOperation(row, applyCheckpoint(row.state, "cooperativa", { type: "risks", risks }, () => false));
      }
      if (!saved) throw new OperationError("El lote cambió durante la verificación. Vuelve a intentarlo.");
    }
    return Response.json({ risks, whispVersion });
  } catch (err) {
    if (err instanceof OperationError) return Response.json({ message: err.message }, { status: err.status });
    if (err instanceof WhispError) return Response.json(err.body, { status: err.status });
    return errorResponse(err, 502);
  }
}
