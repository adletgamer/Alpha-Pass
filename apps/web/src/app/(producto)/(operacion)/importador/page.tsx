"use client";

import { useState } from "react";
import Link from "next/link";
import { eligibleParcels, useLot } from "@/lib/store";
import { canRelease, milestoneAmount, releasedAmount, GATE_MESSAGE } from "@/lib/release-gate";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE, type AssetCode, type Milestone } from "@/lib/domain";
import { ASSETS } from "@/lib/adapters";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import { LotEvidenceDownload } from "@/components/LotEvidenceDownload";
import { ProductHero, ProductMetrics } from "@/components/ProductDisplay";

export default function ImportadorPage() {
  const { lot, preview, practice, busy, operation, fundEscrow, release } = useLot();
  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [amount, setAmount] = useState(TESTNET_ESCROW_AMOUNT);
  const [fundError, setFundError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Milestone, string>>>({});
  const escrow = lot.escrow;
  const individual = practice === "importador";
  const terms = operation.view?.progress.escrow ?? (individual ? escrow : undefined);
  const canEdit = !operation.active || operation.view?.role === "importador";
  const pending = operation.view?.pendingDeploy || operation.view?.pendingFund;
  const parcels = eligibleParcels(lot);
  const canExportEvidence = Boolean(lot.passportRoot) && operation.view?.role === "importador";

  async function fund() {
    setFundError(null);
    try {
      await fundEscrow(asset, amount);
    } catch (error) {
      setFundError(error instanceof Error ? error.message : "No se pudo fondear el escrow.");
    }
  }

  async function tryRelease(m: Milestone) {
    const err = await release(m).catch((failure: Error) => failure.message);
    setErrors((e) => ({ ...e, [m]: err ?? undefined }));
  }

  return (
    <main className="container product-shell">
      <ProductHero label={individual ? "Importador · Práctica individual" : "Importador"} title={lot.id} identifier example={preview}
        description={individual ? "Lote de referencia con pasaporte y atestaciones confirmados en Stellar. Firma el escrow con tu wallet." : `Compra a ${lot.cooperative} · ${lot.product}`}
        actions={individual && <Link href="/probar?rol=importador" className="btn btn-ghost">Cambiar experiencia</Link>}
      />
      <ProductMetrics label="Estado del lote y del pago" items={[
        { label: "Monto del escrow", value: escrow ? <>{escrow.amount.toLocaleString("es-PE")} <span className="product-unit">{escrow.asset}</span></> : "—",
          note: escrow?.funded ? "Fondeado" : "Fondeo pendiente" },
        { label: "Liberado contra prueba", value: <>{releasedAmount(lot).toLocaleString("es-PE")} <span className="product-unit">{escrow?.asset}</span></>,
          note: escrow?.funded ? "Antes de comisiones" : undefined },
        { label: "Pasaporte", value: lot.passportRoot ? "Anclado" : "Pendiente",
          note: individual ? "Registrado en LotPassport" : lot.passportRoot ? `${parcels.length} parcelas aptas` : undefined },
      ]} />

      {!preview && !escrow?.funded && (
        <section className="card" aria-labelledby="fondear">
          <h2 id="fondear">Fondear el escrow</h2>
          <p className="product-subtitle">{individual ? "La contraparte de referencia está preparada para recibir USDC en Testnet." : "El escrow de Trustless Work acepta USDC o EURC."}</p>
          <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
            <label>Moneda
              <select value={terms?.asset ?? asset} disabled={Boolean(terms) || individual} onChange={(e) => setAsset(e.target.value as AssetCode)}>
                {(individual ? [ASSETS.USDC] : Object.values(ASSETS)).map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </label>
            <label>Monto
              <input className="input mono" type="number" min={1} value={terms?.amount ?? amount} disabled={Boolean(terms)} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <button className="btn" type="button" disabled={busy || amount <= 0 || !lot.passportRoot || !canEdit || Boolean(pending)} onClick={fund}>
              {escrow ? "Continuar fondeo" : `Fondear ${(terms?.amount ?? amount).toLocaleString("es-PE")} ${terms?.asset ?? asset}`}
            </button>
          </div>
          {!lot.passportRoot && <span className="error">La cooperativa todavía no ancló el pasaporte del lote.</span>}
          {pending && <p role="status">Hay una transacción pendiente de confirmación. Usa «Actualizar estado» en la guía de Testnet.</p>}
          {fundError && <span className="error" role="alert">{fundError}</span>}
        </section>
      )}

      <section className="card" aria-labelledby="hitos">
        <h2 id="hitos" tabIndex={-1}>Hitos de pago</h2>
        <ol className="product-milestones">
          {MILESTONES.map((m) => {
          const done = escrow?.released[m];
          const gate = canRelease(lot, m);
          const att = lot.attestations.find((a) => a.milestone === m);
          const state = done ? "released" : gate.ok ? "ready" : "held";
          return (
            <li key={m} className="product-milestone" data-state={state}>
              <div className="product-card-heading">
                <h3>{MILESTONE_LABEL[m]}</h3>
                <span className={`pill ${done || gate.ok ? "pill-ok" : "pill-wait"}`}>{done ? "Liberado" : gate.ok ? "Listo para liberar" : "Retenido"}</span>
              </div>
              <strong className="mono product-milestone-share">{MILESTONE_SHARE[m]}%{escrow ? ` · ${milestoneAmount(escrow.amount, m).toLocaleString("es-PE")} ${escrow.asset}` : ""}</strong>
              {att && <p className="muted">Atestación de {att.issuer} · <code className="mono">{att.evidenceHash.slice(0, 12)}…</code></p>}
              {!done && !gate.ok && <p id={`pago-${m}-estado`} className="muted">{GATE_MESSAGE[gate.reason]}</p>}
              {errors[m] && <p className="error" role="alert">{errors[m]}</p>}
              {!preview && !done && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !escrow?.funded || !canEdit}
                  onClick={() => tryRelease(m)}
                  aria-describedby={gate.ok ? undefined : `pago-${m}-estado`}
                >
                  Liberar hito
                </button>
              )}
            </li>
          );
          })}
        </ol>
      </section>

      {!preview && !individual && (
        <section className="card" aria-labelledby="expediente">
          <h2 id="expediente">Expediente del lote</h2>
          <p className="muted" style={{ margin: 0 }}>Reúne la evidencia de origen, las atestaciones y el estado de los pagos en un JSON privado. Comprueba el origen con la raíz del pasaporte.</p>
          {canExportEvidence ? (
            <div className="row" style={{ gap: 12 }}>
              <LotEvidenceDownload load={operation.evidence} label="Descargar expediente" />
              <Link className="btn btn-ghost" href={`/lote/${lot.id}#verificar-expediente`}>Comprobar en el pasaporte</Link>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{operation.view?.role !== "importador"
              ? "Abre el enlace de importador de una operación compartida."
              : "Disponible en cuanto se ancle el pasaporte."}</p>
          )}
        </section>
      )}

      {individual ? <div className="product-inline-actions">
        <Link className="btn btn-ghost" href={`/lote/${lot.id}`}>Ver pasaporte y atestaciones</Link>
        {escrow && <a className="btn btn-ghost" href={`https://stellar.expert/explorer/testnet/contract/${escrow.contractId}`}>Ver escrow en Stellar</a>}
      </div> : <section className="card card-dark" aria-labelledby="dds">
        <h2 id="dds">{preview ? "Parcelas aptas para el expediente" : "Exportar parcelas aptas"}</h2>
        <p style={{ margin: 0 }}>{parcels.length
          ? `El GeoJSON contiene ${parcels.length} ${parcels.length === 1 ? "parcela apta" : "parcelas aptas"}: geometría, superficie y resultado de riesgo.`
          : "Verifica las parcelas en Cooperativa. Podrás descargar el GeoJSON cuando haya parcelas aptas."}</p>
        {!preview && <div className="row" style={{ gap: 12 }}>
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
          {lot.passportRoot && <Link className="btn btn-ghost" style={{ color: "var(--ap-parchment)", borderColor: "var(--ap-parchment)" }} href={`/lote/${lot.id}`}>Ver pasaporte público</Link>}
        </div>}
      </section>}
    </main>
  );
}
