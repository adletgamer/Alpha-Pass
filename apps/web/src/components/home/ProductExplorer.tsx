"use client";

import type { HomeLocale } from "./home-copy";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LotProvider } from "@/lib/store";
import { exampleLot } from "@/lib/example-lot";
import { MILESTONE_SHARE } from "@/lib/domain";
import { MODE } from "@/lib/adapters";
import CooperativaPage from "@/app/(producto)/cooperativa/page";
import ImportadorPage from "@/app/(producto)/importador/page";
import PasaportePublico from "@/app/(producto)/lote/[id]/page";

const VIEWS = [
  {
    key: "cooperativa",
    label: "Cooperativa",
    kicker: "Origen y trazabilidad",
    headline: "Del terreno al lote verificable",
    href: "/cooperativa",
    focus: "Parcelas, verificación satelital, pasaporte del lote y estado del cobro.",
    metrics: ["05 parcelas", "04 aptas", "01 excluida"],
  },
  {
    key: "importador",
    label: "Importador",
    kicker: "Pago con condiciones",
    headline: "Evidencia antes de cada pago",
    href: "/importador",
    focus: "Escrow, hitos de pago, credenciales exigidas y paquete de evidencias.",
    metrics: ["16,500 USDC", "03 hitos", "30% acopio"],
  },
  {
    key: "pasaporte",
    label: "Pasaporte público",
    kicker: "Verificación abierta",
    headline: "Un lote que cualquiera puede revisar",
    href: "/lote/2026-JAE-014",
    focus: "Lo que ve cualquiera que escanee el QR: origen, pruebas y recorrido.",
    metrics: ["01 lote", "04 parcelas aptas", "01 raíz Merkle"],
  },
] as const;

const VIEWS_EN = [
  {
    key: "cooperativa",
    label: "Cooperative",
    kicker: "Origin and traceability",
    headline: "From plots to a verifiable lot",
    href: "/cooperativa",
    focus: "Plots, satellite verification, lot passport and payment status.",
    metrics: ["05 plots", "04 eligible", "01 excluded"],
  },
  {
    key: "importador",
    label: "Importer",
    kicker: "Conditional payment",
    headline: "Evidence before each payment",
    href: "/importador",
    focus: "Escrow, payment milestones, required credentials and evidence package.",
    metrics: ["16,500 USDC", "03 milestones", "30% collection"],
  },
  {
    key: "pasaporte",
    label: "Public passport",
    kicker: "Open verification",
    headline: "A lot anyone can inspect",
    href: "/lote/2026-JAE-014",
    focus: "Scan the QR code to see the lot’s origin, evidence and journey.",
    metrics: ["01 lot", "04 eligible plots", "01 Merkle root"],
  },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];
const lotParams = Promise.resolve({ id: "2026-JAE-014" });
const sample = exampleLot();
const DETAIL = {
  cooperativa: {
    target: "parcelas",
    value: sample.parcels.find((parcel) => parcel.risk === "alerta")?.id,
    label: ["Parcela excluida", "Excluded plot"],
    note: ["La alerta satelital deja esta parcela fuera del lote de ejemplo.", "The satellite alert keeps this plot out of the sample lot."],
  },
  importador: {
    target: "hitos",
    value: `${MILESTONE_SHARE.embarque}%`,
    label: ["Pago de embarque", "Shipment payment"],
    note: ["El pago de embarque requiere una credencial del verificador.", "Shipment payment requires a credential from the verifier."],
  },
  pasaporte: {
    target: "pruebas-lote",
    value: sample.passportRoot && `${sample.passportRoot.slice(0, 12)}…`,
    label: ["Raíz Merkle de ejemplo", "Sample Merkle root"],
    note: ["La raíz reúne las pruebas del lote en una huella verificable.", "The root represents the lot’s evidence in a verifiable fingerprint."],
  },
} as const;

/**
 * Ventana a las pantallas reales del prototipo. Usa los mismos componentes de
 * /cooperativa, /importador y /lote/[id] con un estado de ejemplo propio:
 * servicios simulados, sin persistencia y sin firmar transacciones.
 */
export function ProductExplorer({ locale }: { locale: HomeLocale }) {
  return <LotProvider preview initial={sample}><ExplorerViews locale={locale} /></LotProvider>;
}

function ExplorerViews({ locale }: { locale: HomeLocale }) {
  const views = locale === "en" ? VIEWS_EN : VIEWS;
  const [view, setView] = useState<ViewKey>("cooperativa");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#explorar-pasaporte") setView("pasaporte");
    };
    const fromPassportLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest('a[href="#explorar-pasaporte"]')) {
        setView("pasaporte");
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", fromPassportLink);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", fromPassportLink);
    };
  }, []);

  const current = views.find((v) => v.key === view)!;
  const detail = DETAIL[view];
  const language = locale === "en" ? 1 : 0;

  function showDetail() {
    const heading = previewRef.current?.querySelector<HTMLElement>(`#${detail.target}`);
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "center", behavior: "instant" });
  }

  return (
    <div className="explorer">
      <div className="explorer-topline mono">
        <span>{locale === "en" ? "ALPHA PASS / INTERACTIVE PROTOTYPE" : "ALPHA PASS / PROTOTIPO INTERACTIVO"}</span>
        <span>2026-JAE-014</span>
      </div>
      <div className="explorer-tabs" role="tablist" aria-label={locale === "en" ? "Product views" : "Vistas del producto"}>
        {views.map((v, i) => (
          <button
            key={v.key}
            id={`explorer-tab-${v.key}`}
            role="tab"
            type="button"
            aria-selected={v.key === view}
            aria-controls="explorer-panel"
            tabIndex={v.key === view ? 0 : -1}
            className="explorer-tab"
            onClick={() => setView(v.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const n = views[(i + (e.key === "ArrowRight" ? 1 : views.length - 1)) % views.length];
              setView(n.key);
              document.getElementById(`explorer-tab-${n.key}`)?.focus();
            }}
          >
            <span className="mono explorer-tab-number">{String(i + 1).padStart(2, "0")}</span>
            <span className="explorer-tab-copy"><strong>{v.label}</strong><small>{v.kicker}</small></span>
            <span className="explorer-tab-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className="explorer-stage">
        <div className="explorer-stage-head">
          <div>
            <span className="mono explorer-stage-label">{locale === "en" ? "ACTIVE VIEW" : "VISTA ACTIVA"} · 2026-JAE-014</span>
            <h3>{current.headline}</h3>
            <p className="explorer-focus">{current.focus}</p>
          </div>
          <div className="explorer-metrics" aria-label={locale === "en" ? "Sample lot indicators" : "Indicadores del lote de ejemplo"}>
            {current.metrics.map((metric) => <span key={metric} className="mono">{metric}</span>)}
          </div>
        </div>
        <div className="explorer-evidence">
          <aside className="explorer-detail">
            <span className="mono explorer-detail-label">{detail.label[language]}</span>
            <strong className="mono">{detail.value}</strong>
            <p>{detail.note[language]}</p>
            <button type="button" onClick={showDetail}>
              {language ? "Show in demo" : "Ver en la demo"} <span aria-hidden="true">↘</span>
            </button>
          </aside>
          <div id="explorer-panel" role="tabpanel" aria-labelledby={`explorer-tab-${view}`} className="explorer-window">
            <div className="explorer-chrome">
              <span className="explorer-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="mono explorer-url">alpha-pass{current.href}</span>
              <span className="explorer-badge"><span aria-hidden="true" />{locale === "en" ? "SIMULATION / SAMPLE DATA" : "SIMULACIÓN / DATOS DE EJEMPLO"}</span>
            </div>
            <div className="explorer-body" lang="es" key={view} ref={previewRef}>
              {view === "cooperativa" && <CooperativaPage />}
              {view === "importador" && <ImportadorPage />}
              {view === "pasaporte" && <PasaportePublico params={lotParams} />}
            </div>
          </div>
        </div>
        <div className="explorer-foot">
          <span>{locale === "en" ? "Interactive simulation. No transactions are signed here." : "Vista previa interactiva y simulada: aquí no se firman transacciones."}</span>
          {MODE === "testnet" && (
            <Link href={view === "pasaporte" ? "/lote/2026-JAE-014-E2E6TU" : "/probar"} className="explorer-open">
              {view === "pasaporte"
                ? (locale === "en" ? "See the lot anchored on Testnet" : "Ver lote anclado en Testnet")
                : (locale === "en" ? "Try with a Testnet wallet" : "Probar con wallet en Testnet")} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
