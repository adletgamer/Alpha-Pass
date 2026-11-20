"use client";

import { use, useEffect, useState } from "react";
import { PassportHeader, PassportStats, Milestones, dateFormat } from "@/components/PassportDisplay";
import type { Milestone } from "@/lib/domain";
import { MAX_EVIDENCE_BYTES, verifyLotEvidence, type EvidenceReference } from "@/lib/lot-evidence";
import styles from "@/components/Passport.module.css";

interface OnChainLot {
  contractId: string;
  cooperative: string;
  passportRoot: string;
  parcels: number;
  bags: number;
  createdAt: number;
  attestations: { milestone: Milestone; issuer: string; timestamp: number }[];
}

const EXPLORER = "https://stellar.expert/explorer/testnet";

function VerifyEvidence({ reference }: { reference: EvidenceReference }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string }>();

  async function checkFile(file: File) {
    setChecking(true);
    setResult(undefined);
    try {
      if (file.size > MAX_EVIDENCE_BYTES) throw new Error("El expediente debe pesar menos de 256 KB.");
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("Selecciona el archivo JSON del expediente Alpha Pass.");
      }
      const verification = await verifyLotEvidence(data, reference);
      const messages = {
        matches: "La evidencia de origen coincide con la raíz registrada en Stellar.",
        wrong_lot: "Este expediente pertenece a otro lote.",
        wrong_source: "El expediente corresponde a otro entorno o contrato.",
        invalid: "El archivo no tiene el formato de un expediente Alpha Pass.",
        different: "La evidencia de origen es distinta de la que corresponde a esta raíz.",
      };
      setResult({ ok: verification === "matches", text: messages[verification] });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "No se pudo comprobar el expediente." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className={`card ${styles.section}`} id="verificar-expediente" aria-labelledby="pruebas-lote">
      <h2 id="pruebas-lote" tabIndex={-1}>Comprobar evidencia de origen</h2>
      <p className="muted" id="detalle-verificacion">Compara el origen del expediente con la raíz del pasaporte. El archivo se lee solo en tu dispositivo. La comprobación abarca las parcelas y la composición del lote.</p>
      <dl className={styles.root}>
        <dt>Raíz registrada en Stellar</dt>
        <dd>{reference.root}</dd>
      </dl>
      <label className={styles.upload}>
        Seleccionar expediente JSON
        <input type="file" accept=".json,application/json" aria-describedby="detalle-verificacion" disabled={checking} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void checkFile(file);
        }} />
      </label>
      <div role="status" aria-live="polite">
        {checking && <p className="muted">Calculando la raíz del expediente…</p>}
        {result && <p className={result.ok ? "pill pill-ok" : "error"}>{result.text}</p>}
      </div>
      {reference.source.type === "stellar-testnet" && <a href={`${EXPLORER}/contract/${reference.source.contractId}`} target="_blank" rel="noreferrer">Ver el contrato LotPassport</a>}
    </section>
  );
}

function TestnetPassport({ id }: { id: string }) {
  const [state, setState] = useState<{ lot?: OnChainLot; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/lote/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        setState(response.ok ? { lot: body } : { error: body.message ?? "No se pudo consultar el lote." });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ error: "No se pudo leer LotPassport." });
      });
    return () => controller.abort();
  }, [id]);

  const lot = state.lot;
  return (
    <main className={`container product-shell ${styles.shell}`}>
      <PassportHeader id={id} simulation={false} />
      {lot ? (
        <>
          <PassportStats parcels={lot.parcels} bags={lot.bags} attested={lot.attestations.length} />
          <p className="product-subtitle">Anclado el {dateFormat.format(lot.createdAt * 1000)} · Cooperativa <span className="mono">{lot.cooperative.slice(0, 6)}…{lot.cooperative.slice(-4)}</span></p>
          <div className={styles.grid}>
            <VerifyEvidence reference={{ lotId: id, root: lot.passportRoot, parcels: lot.parcels, source: { type: "stellar-testnet", contractId: lot.contractId } }} />
            <Milestones attestations={lot.attestations.map((proof) => ({ ...proof, date: new Date(proof.timestamp * 1000) }))} />
          </div>
        </>
      ) : <p className="card" role="status">{state.error ?? "Leyendo LotPassport en Stellar Testnet…"}</p>}
    </main>
  );
}

export default function PasaportePublico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TestnetPassport key={id} id={id} />;
}
