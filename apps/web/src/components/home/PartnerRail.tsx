"use client";

import { useRef, useState } from "react";
import type { HomeLocale } from "./home-copy";

const INTEGRATIONS = [
  { key: "whisp", name: "FAO Whisp", role: "Análisis satelital", description: "Cada parcela recibe una evaluación de riesgo de deforestación." },
  { key: "acta", name: "ACTA", role: "Credenciales verificables", description: "Las afirmaciones sobre el lote se convierten en pruebas firmadas y verificables." },
  { key: "trustless", name: "Trustless Work", role: "Escrow por hitos", description: "El pago permanece reservado hasta que se cumple la condición de cada hito." },
] as const;

const INTEGRATIONS_EN = [
  { key: "whisp", name: "FAO Whisp", role: "Satellite analysis", description: "Each plot receives a deforestation risk assessment." },
  { key: "acta", name: "ACTA", role: "Verifiable credentials", description: "Claims about the lot become signed, independently verifiable evidence." },
  { key: "trustless", name: "Trustless Work", role: "Milestone escrow", description: "Payment stays reserved until the condition for each milestone is met." },
] as const;

function IntegrationIcon({ kind }: { kind: (typeof INTEGRATIONS)[number]["key"] }) {
  if (kind === "trustless") return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 5 39 11v12c0 10-6 16-15 20C15 39 9 33 9 23V11L24 5Z" /><path d="m17 24 5 5 10-11" /></svg>;
  if (kind === "acta") return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="10" y="6" width="28" height="36" rx="3" /><path d="M16 16h16M16 22h10m-10 9 4 4 11-10" /></svg>;
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="5" /><path d="M7 24c4-9 11-14 17-14s13 5 17 14c-4 9-11 14-17 14S11 33 7 24ZM24 4v7m0 26v7M4 24h7m26 0h7" /></svg>;
}

export function PartnerRail({ locale }: { locale: HomeLocale }) {
  const items = locale === "en" ? INTEGRATIONS_EN : INTEGRATIONS;
  const railRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  function moveTo(index: number) {
    const rail = railRef.current;
    if (!rail) return;
    const next = Math.max(0, Math.min(items.length - 1, index));
    const cards = rail.querySelectorAll<HTMLElement>(".partner-card");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: cards[next].offsetLeft - cards[0].offsetLeft, behavior: reduced ? "instant" : "smooth" });
    setActive(next);
  }

  function syncPosition() {
    const rail = railRef.current;
    if (!rail) return;
    const cards = rail.querySelectorAll<HTMLElement>(".partner-card");
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1;
    setActive(Math.max(0, Math.min(items.length - 1, Math.round(rail.scrollLeft / step))));
  }

  return (
    <div className="partners">
      <div className="partners-header mono">
        <span>{locale === "en" ? "ORIGIN → EVIDENCE → PAYMENT" : "ORIGEN → EVIDENCIA → PAGO"}</span>
        <span>{locale === "en" ? "SAMPLE INTEGRATION FLOW" : "FLUJO DE INTEGRACIÓN DEL PROTOTIPO"}</span>
      </div>
      <ol className="partner-track" ref={railRef} onScroll={syncPosition} aria-label={locale === "en" ? "Integrated technologies" : "Tecnologías integradas"}>
        {items.map((item, index) => (
          <li className="partner-card" key={item.key}>
            <div className="partner-card-top"><span className="mono">{String(index + 1).padStart(2, "0")}</span><IntegrationIcon kind={item.key} /></div>
            <div><h3>{item.name}</h3><p className="partner-role">{item.role}</p></div>
            <p className="partner-description">{item.description}</p>
          </li>
        ))}
      </ol>
      <div className="partner-controls">
        <span className="mono" aria-live="polite">{String(active + 1).padStart(2, "0")} / 03</span>
        <div>
          <button type="button" aria-label={locale === "en" ? "Previous technology" : "Tecnología anterior"} disabled={active === 0} onClick={() => moveTo(active - 1)}>←</button>
          <button type="button" aria-label={locale === "en" ? "Next technology" : "Siguiente tecnología"} disabled={active === items.length - 1} onClick={() => moveTo(active + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}
