import { MILESTONES, MILESTONE_LABEL, type EscrowState, type Lot, type Milestone } from "@/lib/domain";
import styles from "./Passport.module.css";

export const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });

export function PassportHeader({ id, simulation }: { id: string; simulation: boolean }) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroMeta}>
        <span>Pasaporte de lote</span>
        <span className="pill pill-ok">{simulation ? "Datos ilustrativos" : "Stellar Testnet"}</span>
      </div>
      <h1 className="mono">{id}</h1>
      <p>Alpha Pass · Trazabilidad de origen</p>
    </header>
  );
}

export function PassportStats({ parcels, bags, attested }: { parcels: number; bags: number; attested: number }) {
  return (
    <dl className={styles.stats}>
      <div><dt>Parcelas incluidas</dt><dd>{parcels}</dd></div>
      <div><dt>Sacos registrados</dt><dd>{bags}</dd></div>
      <div><dt>Hitos atestados</dt><dd>{attested}/{MILESTONES.length}</dd></div>
    </dl>
  );
}

export function Milestones({ attestations, released }: {
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
              {released?.[milestone] && <small>Pago liberado · Ejemplo</small>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PassportPreview({ lot }: { lot: Lot }) {
  const parcels = lot.parcels.filter((parcel) => parcel.risk === "sin_riesgo");
  return (
    <main className={`container ${styles.shell}`}>
      <PassportHeader id={lot.id} simulation />
      <PassportStats parcels={parcels.length} bags={parcels.reduce((total, parcel) => total + parcel.bags, 0)} attested={lot.attestations.length} />
      <div className={styles.grid}>
        <section className={`card ${styles.section}`} aria-labelledby="pruebas-lote">
          <h2 id="pruebas-lote" tabIndex={-1}>Evidencia de origen</h2>
          <dl className={styles.root}>
            <dt>Raíz Merkle de ejemplo</dt>
            <dd>{lot.passportRoot}</dd>
          </dl>
        </section>
        <Milestones attestations={lot.attestations.map((proof) => ({ ...proof, date: new Date(proof.timestamp) }))} released={lot.escrow?.released} />
      </div>
    </main>
  );
}
