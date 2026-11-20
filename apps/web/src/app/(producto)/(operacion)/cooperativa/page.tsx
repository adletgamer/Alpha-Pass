"use client";

import { useState } from "react";
import Link from "next/link";
import { eligibleParcels, useLot } from "@/lib/store";
import { releasedAmount } from "@/lib/release-gate";
import { MILESTONES, MILESTONE_LABEL, MILESTONE_SHARE } from "@/lib/domain";

const RISK_LABEL = { sin_riesgo: "Sin riesgo", alerta: "Alerta: revisar", pendiente: "Sin verificar" } as const;
const RISK_CLASS = { sin_riesgo: "pill pill-ok", alerta: "pill pill-alert", pendiente: "pill pill-wait" } as const;

export default function CooperativaPage() {
  const { lot, mode, preview, busy, log, operation, verifyParcels, anchorPassport, reset } = useLot();
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
  const released = releasedAmount(lot);

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="muted">{lot.cooperative} · {lot.product}</div>
          <h1 className="mono">{lot.id}</h1>
          <div className="muted mono">
            {verified ? `${bags} sacos · ${eligible.length} parcelas aptas` : `${lot.parcels.length} parcelas por verificar`} · comprador: {lot.buyer}
          </div>
        </div>
        {!preview && !operation.active && <button className="btn btn-ghost" type="button" disabled={busy} onClick={reset}>Iniciar otro lote</button>}
      </div>

      <div className="row">
        <section className="card grow" aria-labelledby="parcelas">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
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
                <span className="pill pill-ok">{mode === "testnet" ? "Anclado en LotPassport" : "Pasaporte de ejemplo"}</span>
                <div className="mono muted" style={{ wordBreak: "break-all", fontSize: "0.8rem" }}>Raíz {lot.passportRoot}</div>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: 0 }}>Firma las credenciales de identidad, parcelas, deforestación y composición, y ancla su raíz.</p>
                <button className="btn" type="button" disabled={busy || !verified || !canEdit || operation.view?.pendingAnchor} onClick={() => act(anchorPassport)}>
                  {operation.view?.progress.credential ? "Continuar anclaje del pasaporte" : "Crear y anclar pasaporte"}
                </button>
                {!verified && <span className="muted" style={{ fontSize: "0.85rem" }}>Primero verifica las parcelas.</span>}
                  {mode === "testnet" && verified && !operation.view?.progress.credential && (
                    <p className="muted" style={{ margin: 0 }}>Para emitir con ACTA, usa la wallet vinculada a la clave ACTA de este entorno.</p>
                  )}
                {operation.view?.pendingAnchor && <p role="status">Esperando confirmación del anclaje en Stellar.</p>}
                {mode === "testnet" && !operation.active && <Link href="/probar">Abrir una operación compartida</Link>}
              </>
            )}
          </section>

          <section className="card card-dark" aria-labelledby="cobro">
            <h2 id="cobro">3. Cobro</h2>
            {lot.escrow ? (
              <>
                <div className="stat-value mono">{released.toLocaleString("es-PE")} <span style={{ fontSize: "1rem", fontWeight: 500 }}>de {lot.escrow.amount.toLocaleString("es-PE")} {lot.escrow.asset}</span></div>
                <div className="bar" aria-hidden="true"><div style={{ width: `${(released / lot.escrow.amount) * 100}%` }} /></div>
                {MILESTONES.map((m) => (
                  <div key={m} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                    <span>{MILESTONE_LABEL[m]} · {MILESTONE_SHARE[m]}%</span>
                    <strong>{lot.escrow!.released[m] ? "Liberado" : "Pendiente"}</strong>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ margin: 0 }}>Esperando que el importador fondee el escrow.</p>
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
