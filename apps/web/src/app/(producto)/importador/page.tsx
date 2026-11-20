"use client";

import { useState } from "react";
import Link from "next/link";
import { eligibleParcels, useLot } from "@/lib/store";
import { canRelease, milestoneAmount, releasedAmount, GATE_MESSAGE } from "@/lib/release-gate";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE, type AssetCode, type Milestone } from "@/lib/domain";
import { ASSETS } from "@/lib/adapters";
import { DEMO_ESCROW_AMOUNT, TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import { buildLotEvidence } from "@/lib/lot-evidence";
import { LotEvidenceDownload } from "@/components/LotEvidenceDownload";

export default function ImportadorPage() {
  const { lot, mode, preview, busy, operation, fundEscrow, release, attest } = useLot();
  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [amount, setAmount] = useState(mode === "testnet" ? TESTNET_ESCROW_AMOUNT : DEMO_ESCROW_AMOUNT);
  const [fundError, setFundError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Milestone, string>>>({});
  const escrow = lot.escrow;
  const savedEscrow = operation.view?.progress.escrow;
  const canEdit = !operation.active || operation.view?.role === "importador";
  const pending = operation.view?.pendingDeploy || operation.view?.pendingFund;
  const parcels = eligibleParcels(lot);
  const nextProof = MILESTONES.find((m) => !lot.attestations.some((a) => a.milestone === m));
  const canExportEvidence = Boolean(lot.passportRoot) && (mode === "demo" || operation.view?.role === "importador");

  async function fund() {
    setFundError(null);
    try {
      await fundEscrow(asset, amount);
    } catch (error) {
      setFundError(error instanceof Error ? error.message : "No se pudo fondear el escrow.");
    }
  }

  async function addSampleProof() {
    if (!nextProof) return;
    const error = await attest(nextProof, "Verificador de ejemplo", `${lot.id}:${nextProof}`);
    setErrors((current) => ({ ...current, [nextProof]: error ?? undefined }));
  }

  async function tryRelease(m: Milestone) {
    const err = await release(m).catch((failure: Error) => failure.message);
    setErrors((e) => ({ ...e, [m]: err ?? undefined }));
  }

  return (
    <main className="container">
      <div>
        <div className="muted">Compra a {lot.cooperative} · {lot.product}</div>
        <h1 className="mono">Lote {lot.id}</h1>
      </div>

      <div className="stats">
        <div className="card"><span className="muted">En escrow</span><span className="stat-value mono">{escrow ? `${escrow.amount.toLocaleString("es-PE")} ${escrow.asset}` : "Sin fondear"}</span></div>
        <div className="card"><span className="muted">Liberado contra prueba</span><span className="stat-value mono" style={{ color: "var(--ap-green-800)" }}>{releasedAmount(lot).toLocaleString("es-PE")} {escrow?.asset ?? ""}</span></div>
        <div className="card"><span className="muted">Pasaporte</span><span className="stat-value">{lot.passportRoot ? `${eligibleParcels(lot).length} parcelas` : "Sin anclar"}</span></div>
      </div>

      {!escrow?.funded && (
        <section className="card" aria-labelledby="fondear">
          <h2 id="fondear">Fondear el escrow</h2>
          <p className="muted" style={{ margin: 0 }}>Elige la moneda del contrato. El escrow (Trustless Work) acepta USDC o EURC.</p>
          <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
            <label>Moneda
              <select value={savedEscrow?.asset ?? asset} disabled={Boolean(savedEscrow)} onChange={(e) => setAsset(e.target.value as AssetCode)}>
                {Object.values(ASSETS).map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </label>
            <label>Monto
              <input className="input mono" type="number" min={1} value={savedEscrow?.amount ?? amount} disabled={Boolean(savedEscrow)} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <button className="btn" type="button" disabled={busy || amount <= 0 || !lot.passportRoot || !canEdit || Boolean(pending)} onClick={fund}>
              {escrow ? "Continuar fondeo" : `Fondear ${(savedEscrow?.amount ?? amount).toLocaleString("es-PE")} ${savedEscrow?.asset ?? asset}`}
            </button>
          </div>
          {!lot.passportRoot && <span className="error">La cooperativa todavía no ancló el pasaporte del lote.</span>}
          {pending && <p role="status">Hay una transacción pendiente de confirmación. Usa «Actualizar estado» en la guía de Testnet.</p>}
          {fundError && <span className="error" role="alert">{fundError}</span>}
        </section>
      )}

      <section className="card" aria-labelledby="hitos">
        <h2 id="hitos" tabIndex={-1}>Hitos de pago</h2>
        {MILESTONES.map((m, i) => {
          const done = escrow?.released[m];
          const gate = canRelease(lot, m);
          const att = lot.attestations.find((a) => a.milestone === m);
          return (
            <div key={m} className="milestone">
              <div className={`step ${done ? "step-done" : gate.ok ? "step-now" : ""}`}>{i + 1}</div>
              <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 4 }}>
                <strong>{MILESTONE_LABEL[m]} · {MILESTONE_SHARE[m]}%{escrow ? ` · ${milestoneAmount(escrow.amount, m).toLocaleString("es-PE")} ${escrow.asset}` : ""}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {att ? <>Credencial de {att.issuer} · <span className="mono">{att.evidenceHash.slice(0, 12)}…</span></> : "Sin credencial firmada"}
                </span>
                {errors[m] && <span className="error" role="alert">{errors[m]}</span>}
              </div>
              {done ? (
                <span className="pill pill-ok">Liberado</span>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !escrow?.funded || !canEdit}
                  onClick={() => tryRelease(m)}
                  title={gate.ok ? "" : GATE_MESSAGE[gate.reason]}
                >
                  Liberar hito
                </button>
              )}
            </div>
          );
        })}
        {preview && nextProof && escrow && (
          <div>
            <p className="muted">Intenta liberar el hito sin prueba. Después añade una prueba de ejemplo y vuelve a intentarlo.</p>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={addSampleProof}>
              Añadir prueba de ejemplo para {MILESTONE_LABEL[nextProof].toLowerCase()}
            </button>
          </div>
        )}
      </section>

      {!preview && (
        <section className="card" aria-labelledby="expediente">
          <h2 id="expediente">Expediente del lote</h2>
          <p className="muted" style={{ margin: 0 }}>Reúne la evidencia de origen, las atestaciones y el estado de los pagos en un JSON privado. Comprueba el origen con la raíz del pasaporte.</p>
          {canExportEvidence ? (
            <div className="row" style={{ gap: 12 }}>
              <LotEvidenceDownload
                load={mode === "demo" ? () => buildLotEvidence(lot, { type: "simulation" }) : operation.evidence}
                label={mode === "demo" ? "Descargar expediente simulado" : "Descargar expediente"}
              />
              <Link className="btn btn-ghost" href={`/lote/${lot.id}#verificar-expediente`}>Comprobar en el pasaporte</Link>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{mode === "testnet" && operation.view?.role !== "importador"
              ? "Abre el enlace de importador de una operación compartida."
              : "Disponible en cuanto se ancle el pasaporte."}</p>
          )}
        </section>
      )}

      <section className="card card-dark" aria-labelledby="dds">
        <h2 id="dds">Exportar parcelas aptas</h2>
        <p style={{ margin: 0 }}>{parcels.length
          ? `El GeoJSON contiene ${parcels.length} ${parcels.length === 1 ? "parcela apta" : "parcelas aptas"}: geometría, superficie y resultado de riesgo.`
          : "Verifica las parcelas en Cooperativa. Podrás descargar el GeoJSON cuando haya parcelas aptas."}</p>
        <div className="row" style={{ gap: 12 }}>
          {parcels.length > 0 && <a
            className="btn"
            style={{ background: "var(--ap-parchment)", color: "var(--ap-green-800)", borderColor: "var(--ap-parchment)" }}
            download={`${lot.id}-eudr.geojson`}
            href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(JSON.stringify({
              type: "FeatureCollection",
              features: parcels.map((p) => ({ type: "Feature", properties: { id: p.id, producer: p.producer, hectares: p.hectares, risk: p.risk }, geometry: p.geometry })),
            }, null, 2))}`}
          >
            Descargar parcelas en GeoJSON
          </a>}
          {!preview && <Link className="btn btn-ghost" style={{ color: "var(--ap-parchment)", borderColor: "var(--ap-parchment)" }} href={`/lote/${lot.id}`}>Ver pasaporte público</Link>}
        </div>
      </section>
    </main>
  );
}
