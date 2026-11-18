import { describe, expect, it } from "vitest";
import { matchWhispRisks, riskFromWhisp } from "./whisp";

describe("riskFromWhisp", () => {
  it("apta solo con riesgo bajo y sin perturbación después de 2020", () => {
    expect(riskFromWhisp({ risk_pcrop: "low", Ind_04_disturbance_after_2020: "no" })).toBe("sin_riesgo");
    expect(riskFromWhisp({ risk_pcrop: "low", Ind_04_disturbance_after_2020: "yes" })).toBe("alerta");
    expect(riskFromWhisp({ risk_pcrop: "high", Ind_04_disturbance_after_2020: "no" })).toBe("alerta");
    expect(riskFromWhisp({})).toBe("alerta");
  });
});

describe("Whisp parcel matching", () => {
  it("matches by explicit ID regardless of response order", () => {
    expect(matchWhispRisks(["A", "B"], [
      { properties: { alphaId: "B", risk_pcrop: "high" } },
      { properties: { alphaId: "A", risk_pcrop: "low" } },
    ])).toEqual({ A: "sin_riesgo", B: "alerta" });
  });

  it("rejects missing IDs", () => {
    expect(() => matchWhispRisks(["A"], [{ properties: { risk_pcrop: "low" } }])).toThrow();
  });
});
