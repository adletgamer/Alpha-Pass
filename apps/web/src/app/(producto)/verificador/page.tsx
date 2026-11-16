"use client";

import { useState } from "react";
import { useLot } from "@/lib/store";
import { MILESTONES, MILESTONE_LABEL, type Milestone } from "@/lib/domain";

const ISSUERS: Record<Milestone, string> = {
  acopio: "Almacén de acopio (demo)",
  embarque: "Agente de carga (demo)",
  llegada: "Importador en destino (demo)",
};

const EVIDENCE_HINT: Record<Milestone, string> = {
  acopio: "Ej.: guía de recepción 0001-2345, 60 sacos",
  embarque: "Ej.: número del conocimiento de embarque (BL)",
  llegada: "Ej.: acta de recepción en el puerto de destino",
};

export default function VerificadorPage() {
  const { lot, busy, attest } = useLot();
  const next = MILESTONES.find((m) => !lot.attestations.some((a) => a.milestone === m));
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sign(m: Milestone) {
    setError(await attest(m, ISSUERS[m], evidence || `${lot.id}:${m}`));
    setEvidence("");
  }

  return (
    <main className="container">
      <div>
        <div className="muted">Verificador autorizado en LotPassport</div>
        <h1 className="mono">Lote {lot.id}</h1>
      </div>
      <section className="card" aria-labelledby="firmar">
        <h2 id="firmar">Firmar el siguiente hito</h2>
        {!lot.passportRoot ? (
          <p className="error" style={{ margin: 0 }}>El lote todavía no tiene pasaporte anclado.</p>
        ) : next ? (
          <>
            <p style={{ margin: 0 }}>Hito pendiente: <strong>{MILESTONE_LABEL[next]}</strong>. Firmas como: {ISSUERS[next]}.</p>
            <label>Evidencia (se guarda solo su hash SHA-256)
              <input className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={EVIDENCE_HINT[next]} />
            </label>
            <div><button className="btn" type="button" disabled={busy} onClick={() => sign(next)}>Firmar credencial de {MILESTONE_LABEL[next].toLowerCase()}</button></div>
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
                  <td>{a.issuer}</td>
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
