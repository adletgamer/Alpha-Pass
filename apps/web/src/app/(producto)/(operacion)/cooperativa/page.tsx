"use client";

import { useState } from "react";
import Link from "next/link";
import { eligibleParcels, useLot } from "@/lib/store";
import { releasedAmount } from "@/lib/release-gate";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE } from "@/lib/domain";
import { ProductHero, ProductMetrics } from "@/components/ProductDisplay";

const RISK_LABEL = { sin_riesgo: "Sin riesgo", alerta: "Alerta: revisar", pendiente: "Sin verificar" } as const;
const RISK_CLASS = { sin_riesgo: "pill pill-ok", alerta: "pill pill-alert", pendiente: "pill pill-wait" } as const;

export default function CooperativaPage() {
  const { lot, mode, preview, practice, busy, log, operation, verifyParcels, anchorPassport, reset } = useLot();
  const [error, setError] = useState<string | null>(null);
  const canEdit = !operation.active || operation.view?.role === "cooperativa";
  async function act(fn: () => Promise<void>) {
    setError(null);
    try { await fn(); } catch (failure) {
      setError(failure instanceof Error ? failure.message : "La operación no pudo completarse.");
    }
  }
  const eligible = eligibleParcels(lot);
  const verified = lot.parcels.every((p) => p.risk !== "pendiente");
  const bags = eligible.reduce((s, p) => s + p.bags, 0);
  const excluded = lot.parcels.filter((p) => p.risk === "alerta").length;
  const evaluated = lot.parcels.filter((p) => p.risk !== "pendiente").length;
  const released = releasedAmount(lot);
  const individual = practice === "cooperativa";

  return (
    <main className="container product-shell">
      <ProductHero label={individual ? "Cooperativa · Práctica individual" : "Cooperativa"} title={lot.id} identifier example={preview}
        description={`${lot.cooperative} · ${lot.product}`}
        actions={!preview && !operation.active && <>
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={reset}>Iniciar otro lote</button>
          {individual && <Link href="/probar?rol=cooperativa" className="btn btn-ghost">Cambiar experiencia</Link>}
        </>}
      />
      <ProductMetrics label="Composición del lote" items={[
        { label: "Parcelas evaluadas", value: `${evaluated}/${lot.parcels.length}` },
        { label: "Parcelas aptas", value: evaluated ? eligible.length : "—", note: excluded ? `${excluded} con alerta` : undefined },
        { label: "Sacos incluidos", value: evaluated ? bags : "—" },
      ]} />

      <div className="row">
        <section className="card grow" aria-labelledby="parcelas">
          <div className="product-card-heading">
            <h2 id="parcelas" tabIndex={-1}>1. Parcelas del lote</h2>
            {!preview && <button className="btn" type="button" disabled={busy || verified || !canEdit} onClick={() => act(verifyParcels)}>
              {verified ? "Parcelas verificadas" : "Verificar con Whisp (FAO)"}
            </button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Parcela</th><th>Productor</th><th>Área</th><th>Deforestación post-2020</th><th>En el lote</th></tr>
              </thead>
              <tbody>
                {lot.parcels.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id} · {p.name}</td>
                    <td>{p.producer}</td>
                    <td className="mono">{p.hectares} ha</td>
                    <td><span className={RISK_CLASS[p.risk]}>{RISK_LABEL[p.risk]}</span></td>
                    <td className="mono">{p.risk === "alerta" ? "Excluida" : `${p.bags} sacos`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Los polígonos quedan fuera de la cadena. En Stellar solo se guarda la raíz Merkle de las credenciales.
          </p>
        </section>

        <aside className="side">
          <section className="card" aria-labelledby="pasaporte">
            <h2 id="pasaporte">2. Pasaporte</h2>
            {lot.passportRoot ? (
              <>
                <span className="pill pill-ok product-status">{mode === "testnet" ? "Anclado en LotPassport" : "Pasaporte de ejemplo"}</span>
                <div className="product-address"><strong>Raíz Merkle</strong><code className="mono">{lot.passportRoot}</code></div>
                {individual && <Link href={`/lote/${lot.id}`}>Ver pasaporte en Stellar</Link>}
              </>
            ) : (
              <>
                <p className="product-subtitle">{individual
                  ? "Firma el anclaje de la huella de las parcelas aptas en LotPassport."
                  : "Firma la credencial de origen con ACTA y ancla su raíz."}</p>
                <button className="btn" type="button" disabled={busy || !verified || !eligible.length || !canEdit || operation.view?.pendingAnchor} onClick={() => act(anchorPassport)}>
                  {operation.view?.progress.credential ? "Continuar anclaje del pasaporte" : individual ? "Firmar anclaje en Stellar" : "Crear y anclar pasaporte"}
                </button>
                {!verified && <span className="muted" style={{ fontSize: "0.85rem" }}>Primero verifica las parcelas.</span>}
                  {!individual && mode === "testnet" && verified && !operation.view?.progress.credential && (
                    <p className="muted" style={{ margin: 0 }}>Para emitir con ACTA, usa la wallet vinculada a la clave ACTA de este entorno.</p>
                  )}
                {operation.view?.pendingAnchor && <p role="status">Esperando confirmación del anclaje en Stellar.</p>}
                {!individual && mode === "testnet" && !operation.active && <Link href="/probar">Abrir una operación compartida</Link>}
              </>
            )}
          </section>

          <section className="card card-dark product-settlement" aria-labelledby="cobro">
            <h2 id="cobro">3. Cobro</h2>
            {lot.escrow ? (
              <>
                <div className="stat-value mono">{released.toLocaleString("es-PE")} <span className="product-unit">de {lot.escrow.amount.toLocaleString("es-PE")} {lot.escrow.asset}</span></div>
                <p>Importador · {lot.buyer}</p>
                <div className="bar" aria-hidden="true"><div style={{ width: `${(released / lot.escrow.amount) * 100}%` }} /></div>
                {MILESTONES.map((m) => (
                  <div key={m} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                    <span>{MILESTONE_LABEL[m]} · {MILESTONE_SHARE[m]}%</span>
                    <strong>{lot.escrow!.released[m] ? "Liberado" : "Pendiente"}</strong>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ margin: 0 }}>{individual ? "El cobro se prueba desde la experiencia de Importador, sobre un lote de referencia." : "Esperando que el importador fondee el escrow."}</p>
            )}
          </section>

        </aside>
      </div>

      {!preview && <section className="card" aria-labelledby="registro">
        <h2 id="registro">Registro de la operación</h2>
        <ul className="log">{log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>Sin eventos todavía.</li>}</ul>
      </section>}
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
