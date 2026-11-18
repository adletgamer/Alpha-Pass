"use client";

import { use } from "react";
import { eligibleParcels, useLot } from "@/lib/store";
import { MILESTONES, MILESTONE_LABEL } from "@/lib/domain";

export default function PasaportePublico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lot } = useLot();

  if (id !== lot.id) {
    return (
      <main className="container">
        <h1>Lote no encontrado</h1>
        <p className="muted">En la demo solo existe el lote {lot.id}.</p>
      </main>
    );
  }

  const parcels = eligibleParcels(lot);
  const hectares = Math.round(parcels.reduce((s, p) => s + p.hectares, 0) * 10) / 10;
  const bags = parcels.reduce((s, p) => s + p.bags, 0);

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card card-dark">
        <span className="pill" style={{ background: "var(--ap-green-600)", color: "var(--ap-parchment)", alignSelf: "flex-start" }}>
          {lot.passportRoot ? "Pasaporte anclado en Stellar" : "Pasaporte en preparación"}
        </span>
        <div>Pasaporte de lote</div>
        <div className="mono" style={{ fontSize: "2rem", fontWeight: 600 }}>{lot.id}</div>
        <div>{lot.product} · Jaén, Cajamarca, Perú</div>
      </section>
      <div className="stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="card"><span className="muted">Parcelas</span><span className="stat-value mono" style={{ fontSize: "1.4rem" }}>{parcels.length} · {hectares} ha</span></div>
        <div className="card"><span className="muted">Volumen</span><span className="stat-value mono" style={{ fontSize: "1.4rem" }}>{bags} sacos</span></div>
      </div>
      <section className="card">
        <h2 id="pruebas-lote" tabIndex={-1}>Pruebas del lote</h2>
        <Row k="Libre de deforestación post-2020" v={parcels.length > 0 && parcels.every((p) => p.risk === "sin_riesgo") ? "Sí" : "Pendiente"} />
        <Row k="Fuente satelital" v="Whisp (FAO)" />
        <Row k="Organización verificada" v={lot.passportRoot ? "Sí" : "Pendiente"} />
        <Row k="Ubicación exacta de parcelas" v="Solo para el comprador" />
        {lot.passportRoot && <div className="mono muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>Raíz {lot.passportRoot}</div>}
      </section>
      <section className="card">
        <h2>Recorrido</h2>
        {MILESTONES.map((m) => {
          const a = lot.attestations.find((x) => x.milestone === m);
          return <Row key={m} k={MILESTONE_LABEL[m]} v={a ? new Date(a.timestamp).toLocaleDateString("es-PE") : "Pendiente"} />;
        })}
      </section>
      <p className="muted" style={{ textAlign: "center", fontSize: "0.8rem", margin: 0 }}>Demo · datos de ejemplo</p>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
      <span>{k}</span>
      <strong style={{ color: "var(--ap-green-800)" }}>{v}</strong>
    </div>
  );
}
