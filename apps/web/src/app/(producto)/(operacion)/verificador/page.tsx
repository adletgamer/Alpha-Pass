"use client";

import { useState } from "react";
import Link from "next/link";
import { useLot } from "@/lib/store";
import { MILESTONES, MILESTONE_LABEL, type Milestone } from "@/lib/domain";
import { callTestnet, useTestnetWallet } from "@/components/TestnetWallet";
import { ProductHero, ProductMetrics } from "@/components/ProductDisplay";

const EVIDENCE_HINT: Record<Milestone, string> = {
  acopio: "Ej.: guía de recepción 0001-2345, 60 sacos",
  embarque: "Ej.: número del conocimiento de embarque (BL)",
  llegada: "Ej.: acta de recepción en el puerto de destino",
};

export default function VerificadorPage() {
  const { lot, busy, operation, attest } = useLot();
  const wallet = useTestnetWallet();
  const next = MILESTONES.find((m) => !lot.attestations.some((a) => a.milestone === m));
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const correctRole = !operation.active || operation.view?.role === "verificador";
  const allowed = correctRole && Boolean(next && wallet.status?.verifierFor.includes(next));

  async function sign(m: Milestone) {
    setError(null);
    setChecking(true);
    try {
      const { currentAddress } = await import("@/lib/wallet");
      const issuer = await currentAddress();
      if (issuer !== wallet.address) throw new Error("Cambiaste de cuenta. Conecta de nuevo la cuenta que va a firmar.");
      const status = await callTestnet<{ verifierFor: Milestone[] }>({ action: "status", address: issuer });
      if (!status.verifierFor.includes(m)) throw new Error("Esta cuenta no tiene permiso para firmar este hito.");
      const failure = await attest(m, issuer, evidence || `${lot.id}:${m}`);
      setError(failure);
      if (!failure) setEvidence("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo firmar el hito.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="container product-shell">
      <ProductHero label="Verificador" title={lot.id} identifier description="Firma la evidencia de cada hito. LotPassport registra su huella y la cuenta que la atestó." />
      <ProductMetrics label="Estado de atestaciones" items={[
        { label: "Hitos atestados", value: `${lot.attestations.length}/${MILESTONES.length}` },
        { label: "Siguiente hito", value: next ? MILESTONE_LABEL[next] : "Completado" },
        { label: "Permisos de la wallet", value: wallet.status ? `${wallet.status.verifierFor.length}/${MILESTONES.length}` : "—" },
      ]} />
      <section className="card" aria-labelledby="firmar">
        <h2 id="firmar">Firmar el siguiente hito</h2>
        {next && !allowed && (
          <p className="muted" style={{ margin: 0 }}>
            {!correctRole ? "Abre el enlace del verificador para este lote." : wallet.reading ? "Consultando permisos de la wallet…" :
              wallet.address ? "El permiso para este hito aún no está confirmado." : "Conecta una wallet registrada como verificador de prueba."}{" "}
            <Link href="/testnet">Preparar la cuenta en Testnet</Link>
          </p>
        )}
        {!lot.passportRoot ? (
          <p className="error" style={{ margin: 0 }}>El lote todavía no tiene pasaporte anclado.</p>
        ) : next ? (
          <>
            <p style={{ margin: 0 }}>Hito pendiente: <strong>{MILESTONE_LABEL[next]}</strong>.
              {allowed && " La cuenta conectada tiene permiso para firmarlo."}
            </p>
            <label>Evidencia (se guarda solo su hash SHA-256)
              <input className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={EVIDENCE_HINT[next]} />
            </label>
            <div><button className="btn" type="button" disabled={busy || checking || wallet.connecting || !allowed} onClick={() => sign(next)}>{checking ? "Comprobando y firmando…" : `Firmar credencial de ${MILESTONE_LABEL[next].toLowerCase()}`}</button></div>
            {error && <span className="error" role="alert">{error}</span>}
          </>
        ) : (
          <span className="pill pill-ok">Los tres hitos están firmados</span>
        )}
      </section>
      <section className="card" aria-labelledby="hist">
        <h2 id="hist">Credenciales firmadas</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Hito</th><th>Firmante</th><th>Hash de evidencia</th><th>Fecha</th></tr></thead>
            <tbody>
              {lot.attestations.length === 0 && <tr><td colSpan={4} className="muted">Ninguna todavía.</td></tr>}
              {lot.attestations.map((a) => (
                <tr key={a.milestone}>
                  <td>{MILESTONE_LABEL[a.milestone]}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{a.issuer}</td>
                  <td className="mono">{a.evidenceHash.slice(0, 16)}…</td>
                  <td className="mono">{new Date(a.timestamp).toLocaleString("es-PE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
