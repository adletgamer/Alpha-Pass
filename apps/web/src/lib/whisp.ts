// Interpretación del resultado de Whisp para café (cultivo perenne).
// Whisp devuelve `risk_pcrop` (riesgo para cultivos perennes) y el indicador
// `Ind_04_disturbance_after_2020`. Una parcela es apta solo si el riesgo es
// bajo y no hay perturbación del bosque después de 2020 (fecha de corte EUDR).

export interface WhispFeatureProps {
  /** ID propio de la parcela; Whisp lo devuelve si se envía `externalIdColumn`. */
  external_id?: string | null;
  risk_pcrop?: string;
  Ind_04_disturbance_after_2020?: string;
  whisp_processing_metadata?: { whisp_version?: string };
  [k: string]: unknown;
}

export function riskFromWhisp(p: WhispFeatureProps): "sin_riesgo" | "alerta" {
  const lowRisk = (p.risk_pcrop ?? "").toLowerCase() === "low";
  const disturbed = (p.Ind_04_disturbance_after_2020 ?? "").toLowerCase() === "yes";
  return lowRisk && !disturbed ? "sin_riesgo" : "alerta";
}

/** Solo se aceptan IDs explícitos que pertenezcan a la solicitud. */
export function matchWhispRisks(
  requestedIds: string[],
  features: { properties: WhispFeatureProps }[],
): Record<string, "sin_riesgo" | "alerta"> {
  const requested = new Set(requestedIds);
  const risks: Record<string, "sin_riesgo" | "alerta"> = {};
  for (const feature of features) {
    const id = feature.properties.external_id ?? feature.properties.alphaId;
    if (typeof id !== "string" || !requested.has(id) || Object.hasOwn(risks, id)) {
      throw new Error("Whisp devolvió una parcela sin ID válido, ajena a la solicitud o duplicada.");
    }
    risks[id] = riskFromWhisp(feature.properties);
  }
  return risks;
}
