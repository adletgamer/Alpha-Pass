import { describe, expect, it } from "vitest";
import { riskFromWhisp } from "./whisp";

describe("riskFromWhisp", () => {
  it("apta solo con riesgo bajo y sin perturbación después de 2020", () => {
    expect(riskFromWhisp({ risk_pcrop: "low", Ind_04_disturbance_after_2020: "no" })).toBe("sin_riesgo");
    expect(riskFromWhisp({ risk_pcrop: "low", Ind_04_disturbance_after_2020: "yes" })).toBe("alerta");
    expect(riskFromWhisp({ risk_pcrop: "high", Ind_04_disturbance_after_2020: "no" })).toBe("alerta");
    expect(riskFromWhisp({})).toBe("alerta");
  });
});
