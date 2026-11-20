"use client";

import { use, useEffect, useState } from "react";
import { LotEvidenceDownload } from "@/components/LotEvidenceDownload";
import { MILESTONES, MILESTONE_LABEL, type EscrowState, type Milestone } from "@/lib/domain";
import { exampleLot } from "@/lib/example-lot";
import { MAX_EVIDENCE_BYTES, buildLotEvidence, verifyLotEvidence, type EvidenceReference } from "@/lib/lot-evidence";
import { eligibleParcels, useLot } from "@/lib/store";
import styles from "./Passport.module.css";

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
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });
const sample = exampleLot();

function PassportHeader({ id, simulation }: { id: string; simulation: boolean }) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroMeta}>
        <span>Pasaporte de lote</span>
        <span className="pill pill-ok">{simulation ? "Simulación" : "Stellar Testnet"}</span>
      </div>
      <h1 className="mono">{id}</h1>
      <p>Alpha Pass · Trazabilidad de origen</p>
    </header>
  );
}

function PassportStats({ parcels, bags, attested }: { parcels: number; bags: number; attested: number }) {
  return (
    <dl className={styles.stats}>
      <div><dt>Parcelas incluidas</dt><dd>{parcels}</dd></div>
      <div><dt>Sacos registrados</dt><dd>{bags}</dd></div>
      <div><dt>Hitos atestados</dt><dd>{attested}/{MILESTONES.length}</dd></div>
    </dl>
  );
}

function Milestones({ attestations, released }: {
  attestations: { milestone: Milestone; issuer: string; date: Date }[];
  released?: EscrowState["released"];
}) {
  return (
    <section className={`card ${styles.section}`} aria-labelledby="hitos-del-pasaporte">
      <h2 id="hitos-del-pasaporte">Hitos del lote</h2>
      <ol className={styles.timeline}>
        {MILESTONES.map((milestone) => {
          const proof = attestations.find((attestation) => attestation.milestone === milestone);
          return (
            <li key={milestone}>
              <strong>{MILESTONE_LABEL[milestone]}</strong>
              <span className={`pill ${proof ? "pill-ok" : "pill-wait"}`}>{proof ? "Atestado" : "Pendiente"}</span>
              {proof && <small>{dateFormat.format(proof.date)} · <span className="mono">{proof.issuer}</span></small>}
              {released?.[milestone] && <small>Pago simulado liberado</small>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function VerifyEvidence({ reference, download }: {
  reference: EvidenceReference;
  download?: () => ReturnType<typeof buildLotEvidence>;
}) {
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
        matches: reference.source.type === "simulation" ? "La evidencia coincide con la raíz de ejemplo." : "La evidencia de origen coincide con la raíz registrada en Stellar.",
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
        <dt>{reference.source.type === "simulation" ? "Raíz de ejemplo" : "Raíz registrada en Stellar"}</dt>
        <dd>{reference.root}</dd>
      </dl>
      {download && <LotEvidenceDownload load={download} label="Descargar expediente de ejemplo" />}
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
    <main className={`container ${styles.shell}`}>
      <PassportHeader id={id} simulation={false} />
      {lot ? (
        <>
          <PassportStats parcels={lot.parcels} bags={lot.bags} attested={lot.attestations.length} />
          <p className="muted">Anclado el {dateFormat.format(lot.createdAt * 1000)} · Cooperativa <span className="mono">{lot.cooperative.slice(0, 6)}…{lot.cooperative.slice(-4)}</span></p>
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
  const { lot: localLot, mode } = useLot();
  const isExample = id === "ejemplo";

  if (!isExample && mode === "testnet") return <TestnetPassport key={id} id={id} />;
  if (!isExample && id !== localLot.id) {
    return (
      <main className="container">
        <h1>Lote no encontrado</h1>
        <p className="muted">El lote activo de la simulación es {localLot.id}.</p>
      </main>
    );
  }

  const lot = isExample ? sample : localLot;
  const parcels = eligibleParcels(lot);
  const source = { type: "simulation" } as const;
  return (
    <main className={`container ${styles.shell}`}>
      <PassportHeader id={lot.id} simulation />
      <PassportStats parcels={parcels.length} bags={parcels.reduce((total, parcel) => total + parcel.bags, 0)} attested={lot.attestations.length} />
      <p className="muted">{lot.product} · Jaén, Cajamarca, Perú · Datos de ejemplo</p>
      <div className={styles.grid}>
        {lot.passportRoot ? (
          <VerifyEvidence
            reference={{ lotId: lot.id, root: lot.passportRoot, parcels: parcels.length, source }}
            download={isExample ? () => buildLotEvidence(lot, source) : undefined}
          />
        ) : (
          <section className="card" aria-labelledby="pruebas-lote">
            <h2 id="pruebas-lote">Evidencia de origen</h2>
            <p className="muted">Completa el anclaje simulado desde Cooperativa para obtener la raíz del pasaporte.</p>
          </section>
        )}
        <Milestones attestations={lot.attestations.map((proof) => ({ ...proof, date: new Date(proof.timestamp) }))} released={lot.escrow?.released} />
      </div>
    </main>
  );
}
