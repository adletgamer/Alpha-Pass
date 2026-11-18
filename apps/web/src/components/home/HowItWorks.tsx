"use client";

import type { HomeLocale } from "./home-copy";

import { useState } from "react";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE } from "@/lib/domain";

const STEPS = [
  {
    n: "01",
    title: "Registrar el origen",
    text: "La cooperativa registra las parcelas en GeoJSON y vincula a cada productor con el lote que exporta.",
    detail: ["5 parcelas cargadas", "Cada productor ligado a su parcela", "Polígonos fuera de la cadena"],
  },
  {
    n: "02",
    title: "Verificar la evidencia",
    text: "Whisp, de la FAO, evalúa el riesgo de deforestación de cada parcela con datos satelitales. Las aptas reciben credenciales firmadas.",
    detail: ["4 parcelas sin riesgo", "1 parcela con alerta, excluida", "Credenciales W3C emitidas con ACTA"],
  },
  {
    n: "03",
    title: "Crear el pasaporte",
    text: "El lote recibe un pasaporte que reúne su información de trazabilidad. Su huella criptográfica (raíz Merkle) queda anclada en Stellar.",
    detail: ["Lote 2026-JAE-014", "60 sacos de 69 kg", "Raíz Merkle en el contrato LotPassport"],
  },
  {
    n: "04",
    title: "Liberar el pago",
    text: "El importador deposita el pago en un escrow. Cada hito se libera solo si el contrato confirma su credencial firmada.",
    detail: ["Escrow por hitos con Trustless Work", "Sin prueba, el pago no se mueve", "Liquidación con activos digitales en Stellar"],
  },
];

const STEPS_EN = [
  {
    n: "01",
    title: "Record the origin",
    text: "The cooperative records each plot in GeoJSON and links each grower to the export lot.",
    detail: ["5 plots uploaded", "Each grower linked to their plot", "Polygons stored off-chain"],
  },
  {
    n: "02",
    title: "Verify the evidence",
    text: "FAO Whisp assesses deforestation risk for each plot using satellite data. Eligible plots receive signed credentials.",
    detail: ["4 plots without a risk alert", "1 flagged plot excluded", "W3C credentials issued with ACTA"],
  },
  {
    n: "03",
    title: "Create the passport",
    text: "The lot passport brings together traceability information. Its cryptographic fingerprint (Merkle root) is anchored on Stellar.",
    detail: ["Lot 2026-JAE-014", "60 bags of 69 kg", "Merkle root in the LotPassport contract"],
  },
  {
    n: "04",
    title: "Release payment",
    text: "The importer deposits payment into escrow. Each milestone is paid only once the contract confirms its signed credential.",
    detail: ["Milestone escrow with Trustless Work", "Payment requires proof", "Settlement with digital assets on Stellar"],
  },
];

export function HowItWorks({ locale }: { locale: HomeLocale }) {
  const steps = locale === "en" ? STEPS_EN : STEPS;
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <div className="how">
      <div className="how-tabs" role="tablist" aria-label={locale === "en" ? "Transaction stages" : "Etapas de una operación"}>
        {steps.map((s, i) => (
          <button
            key={s.n}
            id={`how-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="how-panel"
            tabIndex={i === active ? 0 : -1}
            className="how-tab"
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault();
                const n = (i + 1) % steps.length;
                setActive(n);
                document.getElementById(`how-tab-${n}`)?.focus();
              }
              if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                const n = (i - 1 + steps.length) % steps.length;
                setActive(n);
                document.getElementById(`how-tab-${n}`)?.focus();
              }
            }}
          >
            <span className="mono how-n">{s.n}</span>
            <span className="how-title">{s.title}</span>
          </button>
        ))}
      </div>
      <div id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${active}`} className="how-panel">
        <p className="how-text">{step.text}</p>
        <StepVisual step={active} locale={locale} />
        <ul className="how-detail">
          {step.detail.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </div>
    </div>
  );
}

const MILESTONE_LABEL_EN = { acopio: "Collection", embarque: "Shipment", llegada: "Arrival" };

function StepVisual({ step, locale }: { step: number; locale: HomeLocale }) {
  if (step === 3) {
    return (
      <div className="how-visual" aria-label={locale === "en" ? "Sample lot payment milestones" : "Hitos de pago del lote de ejemplo"}>
        <div className="milestone-bar">
          {MILESTONES.map((m, i) => (
            <div key={m} className={`milestone-seg${i === 0 ? " is-released" : ""}`} style={{ flexGrow: MILESTONE_SHARE[m] }}>
              <span className="mono">{MILESTONE_SHARE[m]}%</span>
              <span>{locale === "en" ? MILESTONE_LABEL_EN[m] : MILESTONE_LABEL[m]}</span>
            </div>
          ))}
        </div>
        <p className="how-note">{locale === "en" ? "These are sample milestones. Each transaction defines its own." : "Configuración ilustrativa de la demo. Cada operación define sus propios hitos."}</p>
      </div>
    );
  }
  const parcels = [
    { id: "P-01", ok: true }, { id: "P-02", ok: true }, { id: "P-03", ok: true }, { id: "P-04", ok: true }, { id: "P-05", ok: false },
  ];
  return (
    <div className="how-visual" aria-hidden="true">
      <div className="how-parcels">
        {parcels.map((p) => {
          const verified = step >= 1;
          const cls = !verified ? "is-pending" : p.ok ? "is-ok" : "is-alert";
          return (
            <div key={p.id} className={`how-parcel ${cls}${step === 2 && !p.ok ? " is-out" : ""}`}>
              <span className="mono">{p.id}</span>
              <span>{locale === "en"
                ? (!verified ? "Recorded" : p.ok ? "Low risk" : "Alert")
                : (!verified ? "Registrada" : p.ok ? "Sin riesgo" : "Alerta")}</span>
            </div>
          );
        })}
        {step === 2 && (
          <div className="how-passport">
            <span className="mono">2026-JAE-014</span>
            <span className="mono how-root">{locale === "en" ? "root" : "raíz"} 42a439f1…98017bb</span>
          </div>
        )}
      </div>
    </div>
  );
}
