"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LotProvider } from "@/lib/store";
import { exampleLot } from "@/lib/example-lot";
import CooperativaPage from "@/app/(producto)/cooperativa/page";
import ImportadorPage from "@/app/(producto)/importador/page";
import PasaportePublico from "@/app/(producto)/lote/[id]/page";

const VIEWS = [
  {
    key: "cooperativa",
    label: "Cooperativa",
    href: "/cooperativa",
    focus: "Parcelas, verificación satelital, pasaporte del lote y estado del cobro.",
  },
  {
    key: "importador",
    label: "Importador",
    href: "/importador",
    focus: "Escrow, hitos de pago, credenciales exigidas y paquete de evidencias.",
  },
  {
    key: "pasaporte",
    label: "Pasaporte público",
    href: "/lote/2026-JAE-014",
    focus: "Lo que ve cualquiera que escanee el QR: origen, pruebas y recorrido.",
  },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];
const lotParams = Promise.resolve({ id: "2026-JAE-014" });

/**
 * Ventana a las pantallas reales del prototipo. Usa los mismos componentes de
 * /cooperativa, /importador y /lote/[id] con un estado de ejemplo propio:
 * servicios simulados, sin persistencia y sin firmar transacciones.
 */
export function ProductExplorer() {
  const [view, setView] = useState<ViewKey>("cooperativa");

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#explorar-pasaporte") setView("pasaporte");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const current = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="explorer">
      <div className="explorer-tabs" role="tablist" aria-label="Vistas del producto">
        {VIEWS.map((v, i) => (
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
              const n = VIEWS[(i + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
              setView(n.key);
              document.getElementById(`explorer-tab-${n.key}`)?.focus();
            }}
          >
            <span className="mono">{String(i + 1).padStart(2, "0")}</span> {v.label}
          </button>
        ))}
      </div>
      <p className="explorer-focus">{current.focus}</p>
      <div id="explorer-panel" role="tabpanel" aria-labelledby={`explorer-tab-${view}`} className="explorer-window">
        <div className="explorer-chrome">
          <span className="explorer-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="mono explorer-url">alpha-pass{current.href}</span>
          <span className="explorer-badge">Demo en Stellar Testnet · Datos de ejemplo</span>
        </div>
        <div className="explorer-body" key={view}>
          <LotProvider preview initial={exampleLot()}>
            {view === "cooperativa" && <CooperativaPage />}
            {view === "importador" && <ImportadorPage />}
            {view === "pasaporte" && <PasaportePublico params={lotParams} />}
          </LotProvider>
        </div>
      </div>
      <div className="explorer-foot">
        <span>Vista previa interactiva y simulada: aquí no se firman transacciones.</span>
        <Link href={current.href} className="btn btn-ghost">Abrir {current.label.toLowerCase()} en el prototipo</Link>
      </div>
    </div>
  );
}
