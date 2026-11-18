"use client";

import { useState } from "react";
import Link from "next/link";
import { eligibleParcels, useLot } from "@/lib/store";
import { canRelease, milestoneAmount, releasedAmount, GATE_MESSAGE } from "@/lib/release-gate";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE, type AssetCode, type Milestone } from "@/lib/domain";
import { ASSETS } from "@/lib/adapters";
import { DEMO_ESCROW_AMOUNT } from "@/lib/sample-data";

export default function ImportadorPage() {
  const { lot, busy, fundEscrow, release } = useLot();
  const [asset, setAsset] = useState<AssetCode>("USDC");
  const [amount, setAmount] = useState(DEMO_ESCROW_AMOUNT);
  const [errors, setErrors] = useState<Partial<Record<Milestone, string>>>({});
  const escrow = lot.escrow;

  async function tryRelease(m: Milestone) {
    const err = await release(m);
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

      {!escrow && (
        <section className="card" aria-labelledby="fondear">
          <h2 id="fondear">Fondear el escrow</h2>
          <p className="muted" style={{ margin: 0 }}>Elige la moneda del contrato. El escrow (Trustless Work) acepta USDC o EURC.</p>
          <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
            <label>Moneda
              <select value={asset} onChange={(e) => setAsset(e.target.value as AssetCode)}>
                {Object.values(ASSETS).map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </label>
            <label>Monto
              <input className="input mono" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <button className="btn" type="button" disabled={busy || amount <= 0 || !lot.passportRoot} onClick={() => fundEscrow(asset, amount)}>
              Fondear {amount.toLocaleString("es-PE")} {asset}
            </button>
          </div>
          {!lot.passportRoot && <span className="error">La cooperativa todavía no ancló el pasaporte del lote.</span>}
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
                  disabled={busy || !escrow}
                  onClick={() => tryRelease(m)}
                  title={gate.ok ? "" : GATE_MESSAGE[gate.reason]}
                >
                  Liberar hito
                </button>
              )}
            </div>
          );
        })}
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Prueba a liberar el embarque antes de que exista su credencial: Alpha Pass lo rechaza.
        </p>
      </section>

      <section className="card card-dark" aria-labelledby="dds">
        <h2 id="dds">Paquete para la declaración EUDR</h2>
        <p style={{ margin: 0 }}>GeoJSON de las parcelas aptas, resultados de verificación y credenciales del lote, listos para el sistema TRACES.</p>
        <div className="row" style={{ gap: 12 }}>
          <a
            className="btn"
            style={{ background: "var(--ap-parchment)", color: "var(--ap-green-800)", borderColor: "var(--ap-parchment)" }}
            download={`${lot.id}-eudr.geojson`}
            href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(JSON.stringify({
              type: "FeatureCollection",
              features: eligibleParcels(lot).map((p) => ({ type: "Feature", properties: { id: p.id, producer: p.producer, hectares: p.hectares, risk: p.risk }, geometry: p.geometry })),
            }, null, 2))}`}
          >
            Descargar GeoJSON
          </a>
          <Link className="btn btn-ghost" style={{ color: "var(--ap-parchment)", borderColor: "var(--ap-parchment)" }} href={`/lote/${lot.id}`}>Ver pasaporte público</Link>
        </div>
      </section>
    </main>
  );
}
