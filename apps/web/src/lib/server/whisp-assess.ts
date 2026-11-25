import "server-only";
// Evaluación de riesgo de deforestación con la API de Whisp (FAO), reutilizable
// desde la ruta /api/whisp y desde la demo guiada.
// Documentación: https://whisp.openforis.org/api/openapi.json
import { serverEnv } from "./env";
import { matchWhispRisks, type WhispFeatureProps } from "../whisp";

export interface WhispParcel {
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export class WhispError extends Error {
  constructor(public status: number, public body: unknown, message = "Whisp no completó la evaluación.") {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function assessWithWhisp(parcels: WhispParcel[]) {
  const { url, key } = serverEnv.whisp();
  const headers = { "Content-Type": "application/json", "x-api-key": key };
  const submit = await fetch(`${url}/api/submit/geojson`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "FeatureCollection",
      features: parcels.map((p) => ({ type: "Feature", properties: { alphaId: p.id }, geometry: p.geometry })),
      // Whisp descarta las propiedades propias; externalIdColumn devuelve el ID como external_id.
      analysisOptions: { async: true, unitType: "ha", externalIdColumn: "alphaId" },
    }),
  });
  let payload = await submit.json();
  if (!submit.ok && submit.status !== 202) throw new WhispError(submit.status, payload);
  // Análisis asíncrono: consultar el estado hasta ~50 s.
  for (let i = 0; payload.code !== "analysis_completed" && payload.data?.token && i < 25; i++) {
    await sleep(2000);
    const st = await fetch(`${url}/api/status/${payload.data.token}`, { headers: { "x-api-key": key } });
    payload = await st.json();
    if (!st.ok && st.status !== 202) throw new WhispError(st.status, payload);
  }
  if (payload.code !== "analysis_completed") {
    throw new WhispError(504, { code: "timeout", message: "Whisp todavía está procesando; intenta de nuevo." }, "Whisp todavía está procesando; intenta de nuevo.");
  }
  const features: { properties: WhispFeatureProps }[] = payload.data?.features ?? [];
  return {
    risks: matchWhispRisks(parcels.map((p) => p.id), features),
    whispVersion: features[0]?.properties.whisp_processing_metadata?.whisp_version ?? null,
  };
}
