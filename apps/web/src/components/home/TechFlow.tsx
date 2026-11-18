"use client";

import type { HomeLocale } from "./home-copy";

import { useState } from "react";

const NODES = [
  {
    key: "whisp",
    name: "FAO Whisp",
    role: "Riesgo de deforestación",
    text: "Analiza cada parcela con datos satelitales públicos y marca si hubo pérdida de bosque después de 2020. Es la evidencia ambiental del lote.",
  },
  {
    key: "acta",
    name: "ACTA",
    role: "Credenciales verificables",
    text: "La cooperativa firma credenciales W3C con su identidad digital (did:stellar). Cualquiera puede comprobar quién afirmó qué y cuándo.",
  },
  {
    key: "stellar",
    name: "Stellar",
    role: "Anclaje y liquidación",
    text: "El contrato LotPassport guarda la huella del pasaporte y las pruebas de cada hito. La red liquida los pagos en segundos y con costo mínimo.",
  },
  {
    key: "trustless",
    name: "Trustless Work",
    role: "Escrow por hitos",
    text: "Custodia el pago del comprador en un contrato y lo libera por partes. Alpha Pass solo aprueba un hito si LotPassport confirma su prueba.",
  },
  {
    key: "circle",
    name: "Circle",
    role: "Activos de liquidación",
    text: "USDC y EURC, dólar y euro digitales emitidos por Circle, son los activos con los que el comprador fondea el escrow.",
  },
] as const;

const NODES_EN = [
  {
    key: "whisp",
    name: "FAO Whisp",
    role: "Deforestation risk",
    text: "Analyzes each plot using public satellite data and flags forest loss after 2020 to provide environmental evidence for the lot.",
  },
  {
    key: "acta",
    name: "ACTA",
    role: "Verifiable credentials",
    text: "The cooperative signs W3C credentials with its digital identity (did:stellar). Anyone can verify who made a claim and when.",
  },
  {
    key: "stellar",
    name: "Stellar",
    role: "Anchoring and settlement",
    text: "The LotPassport contract records the passport fingerprint and each milestone proof. Stellar settles payments within seconds at low cost.",
  },
  {
    key: "trustless",
    name: "Trustless Work",
    role: "Milestone escrow",
    text: "Holds the buyer’s payment in a contract and releases it in installments. Alpha Pass approves a milestone only after LotPassport confirms its proof.",
  },
  {
    key: "circle",
    name: "Circle",
    role: "Settlement assets",
    text: "The buyer funds escrow with USDC or EURC, digital dollars and euros issued by Circle.",
  },
] as const;

export function TechFlow({ locale }: { locale: HomeLocale }) {
  const nodes = locale === "en" ? NODES_EN : NODES;
  const [active, setActive] = useState(0);
  const node = nodes[active];
  return (
    <div className="tech">
      <ol className="tech-flow" aria-label={locale === "en" ? "Transaction flow and tools" : "Flujo de una operación y la herramienta de cada paso"}>
        {nodes.map((n, i) => (
          <li key={n.key}>
            <button
              type="button"
              className={`tech-node${i === active ? " is-active" : ""}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
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
      </div>
    </div>
  );
}
