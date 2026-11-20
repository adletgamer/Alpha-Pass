"use client";

import { homeCopy, type HomeLocale } from "./home-copy";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LotProvider } from "@/lib/store";
import { exampleLot } from "@/lib/example-lot";
import { MILESTONE_SHARE } from "@/lib/domain";
import { PUBLIC_TESTNET_LOT_PATH } from "@/lib/sample-data";
import CooperativaPage from "@/app/(producto)/(operacion)/cooperativa/page";
import ImportadorPage from "@/app/(producto)/(operacion)/importador/page";
import { PassportPreview } from "@/components/PassportDisplay";

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
 * Vistas de lectura con el mismo lote ilustrativo. Las operaciones ocurren
 * dentro del flujo de Stellar Testnet.
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
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
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
        <span>{locale === "en" ? "ALPHA PASS / PRODUCT VIEWS" : "ALPHA PASS / VISTAS DEL PRODUCTO"}</span>
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
              {language ? "Show in this view" : "Ver en esta vista"} <span aria-hidden="true">↘</span>
            </button>
          </aside>
          <div id="explorer-panel" role="tabpanel" aria-labelledby={`explorer-tab-${view}`} className="explorer-window">
            <div className="explorer-chrome">
              <span className="explorer-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="mono explorer-url">alpha-pass{current.href}</span>
              <span className="explorer-badge"><span aria-hidden="true" />{locale === "en" ? "READ ONLY" : "SOLO LECTURA"}</span>
            </div>
            <div className="explorer-body" lang="es" key={view} ref={previewRef}>
              {view === "cooperativa" && <CooperativaPage />}
              {view === "importador" && <ImportadorPage />}
              {view === "pasaporte" && <PassportPreview lot={sample} />}
            </div>
          </div>
        </div>
        <div className="explorer-foot">
          <span>{locale === "en" ? "The sample data describes the workflow on Stellar." : "Datos ilustrativos del flujo de Stellar."}</span>
          <Link href={view === "pasaporte" ? PUBLIC_TESTNET_LOT_PATH : view === "importador" ? "/testnet?rol=importador" : "/testnet"} className="explorer-open">
            {view === "pasaporte"
              ? (locale === "en" ? "See a lot anchored on Testnet" : "Ver un lote anclado en Testnet")
              : homeCopy[locale].testnetCta} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
