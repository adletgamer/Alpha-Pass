// Evaluación de riesgo de deforestación por parcela con la API de Whisp (FAO).
// Documentación: https://whisp.openforis.org/api/openapi.json
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";
import { matchWhispRisks, type WhispFeatureProps } from "@/lib/whisp";

interface Body {
  parcels: { id: string; geometry: { type: "Polygon"; coordinates: number[][][] } }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { url, key } = serverEnv.whisp();
    const { parcels } = (await request.json()) as Body;
    if (!Array.isArray(parcels) || parcels.length === 0 || parcels.length > 200) {
      return Response.json({ code: "invalid", message: "Envía entre 1 y 200 parcelas" }, { status: 400 });
    }
    const headers = { "Content-Type": "application/json", "x-api-key": key };
    const submit = await fetch(`${url}/api/submit/geojson`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "FeatureCollection",
        features: parcels.map((p) => ({ type: "Feature", properties: { alphaId: p.id }, geometry: p.geometry })),
        analysisOptions: { async: true, unitType: "ha" },
      }),
    });
    let payload = await submit.json();
    if (!submit.ok && submit.status !== 202) {
      return Response.json(payload, { status: submit.status });
    }
    // Análisis asíncrono: consultar el estado hasta ~50 s.
    for (let i = 0; payload.code !== "analysis_completed" && payload.data?.token && i < 25; i++) {
      await sleep(2000);
      const st = await fetch(`${url}/api/status/${payload.data.token}`, { headers: { "x-api-key": key } });
      payload = await st.json();
      if (!st.ok && st.status !== 202) return Response.json(payload, { status: st.status });
    }
    if (payload.code !== "analysis_completed") {
      return Response.json({ code: "timeout", message: "Whisp todavía está procesando; intenta de nuevo." }, { status: 504 });
    }
    const features: { properties: WhispFeatureProps }[] = payload.data?.features ?? [];
    const risks = matchWhispRisks(parcels.map((p) => p.id), features);
    return Response.json({ risks, whispVersion: features[0]?.properties.whisp_processing_metadata?.whisp_version ?? null });
  } catch (err) {
    return errorResponse(err, 502);
  }
}
