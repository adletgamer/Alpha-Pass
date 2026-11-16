// Interpretación del resultado de Whisp para café (cultivo perenne).
// Whisp devuelve `risk_pcrop` (riesgo para cultivos perennes) y el indicador
// `Ind_04_disturbance_after_2020`. Una parcela es apta solo si el riesgo es
// bajo y no hay perturbación del bosque después de 2020 (fecha de corte EUDR).

export interface WhispFeatureProps {
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
