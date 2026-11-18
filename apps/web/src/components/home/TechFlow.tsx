"use client";

import { useState } from "react";

const NODES = [
  {
    key: "whisp",
    name: "FAO Whisp",
    role: "Riesgo de deforestación",
    text: "Analiza cada parcela con datos satelitales públicos y marca si hubo pérdida de bosque después de 2020. Es la evidencia ambiental del lote.",
    input: "Polígonos de parcelas",
    output: "Resultado por parcela",
  },
  {
    key: "acta",
    name: "ACTA",
    role: "Credenciales verificables",
    text: "La cooperativa firma credenciales W3C con su identidad digital (did:stellar). Cualquiera puede comprobar quién afirmó qué y cuándo.",
    input: "Resultado y emisor",
    output: "Credencial firmada",
  },
  {
    key: "stellar",
    name: "Stellar",
    role: "Anclaje y liquidación",
    text: "El contrato LotPassport guarda la huella del pasaporte y las pruebas de cada hito. La red liquida los pagos en segundos y con costo mínimo.",
    input: "Pasaporte y pruebas",
    output: "Huella verificable",
  },
  {
    key: "trustless",
    name: "Trustless Work",
    role: "Escrow por hitos",
    text: "Custodia el pago del comprador en un contrato y lo libera por partes. Alpha Pass solo aprueba un hito si LotPassport confirma su prueba.",
    input: "Depósito y condiciones",
    output: "Pago por hitos",
  },
  {
    key: "circle",
    name: "Circle",
    role: "Activos de liquidación",
    text: "USDC y EURC, dólar y euro digitales emitidos por Circle, son los activos con los que el comprador fondea el escrow.",
    input: "Fondos del comprador",
    output: "USDC o EURC",
  },
] as const;

export function TechFlow() {
  const [active, setActive] = useState(0);
  const node = NODES[active];
  return (
    <div className="tech">
      <ol className="tech-flow" aria-label="Flujo de una operación y la herramienta de cada paso">
        {NODES.map((n, i) => (
          <li key={n.key}>
            <button
              type="button"
              className={`tech-node${i === active ? " is-active" : ""}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              <span className="tech-name">{n.name}</span>
              <span className="tech-role">{n.role}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="tech-detail" aria-live="polite">
        <span className="mono tech-step">{String(active + 1).padStart(2, "0")} / 05</span>
        <h3>{node.name} · {node.role}</h3>
        <p>{node.text}</p>
        <div className="tech-dataflow" aria-label={`De ${node.input} a ${node.output}`}>
          <div><span className="mono">Entrada</span><strong>{node.input}</strong></div>
          <span className="tech-dataflow-arrow" aria-hidden="true">→</span>
          <div><span className="mono">Resultado</span><strong>{node.output}</strong></div>
        </div>
      </div>
    </div>
  );
}
