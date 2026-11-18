import Image from "next/image";
import { exampleLot } from "@/lib/example-lot";
import { releasedAmount } from "@/lib/release-gate";
import { homeCopy, type HomeLocale } from "./home-copy";

const lot = exampleLot();
const eligible = lot.parcels.filter((parcel) => parcel.risk === "sin_riesgo");
const excluded = lot.parcels.find((parcel) => parcel.risk === "alerta");
const bags = eligible.reduce((total, parcel) => total + parcel.bags, 0);

export function TrustChain({ locale }: { locale: HomeLocale }) {
  const en = locale === "en";
  return (
    <section className="band trust-band" id="cadena-de-confianza" aria-labelledby="trust-title">
      <div className="wrap">
        <div className="editorial-heading">
          <div>
            <p className="eyebrow">{homeCopy[locale].trustChain}</p>
            <h2 className="section-title" id="trust-title">{en ? "Follow the evidence." : "Sigue la evidencia."}</h2>
          </div>
          <p className="section-lead">
            {en ? "One sample lot links the origin record to each payment decision." : "Un lote de ejemplo conecta el registro de origen con cada decisión de pago."}
          </p>
        </div>

        <div className="trust-board">
          <figure className="trust-photo">
            <Image src="/home/coffee-landscape.webp" alt={en ? "Coffee plots and a footpath on a green Andean hillside" : "Parcelas cafetaleras y un sendero en una ladera andina"} fill sizes="(max-width: 1200px) 94vw, 1130px" />
            <figcaption className="mono">{en ? "Andean coffee landscape · Generated illustration" : "Paisaje cafetalero andino · Ilustración generada"}</figcaption>
          </figure>

          <article className="trust-passport" aria-labelledby="sample-passport-heading">
            <header className="trust-passport-header">
              <Image src="/brand/alpha-pass-symbol.svg" alt="Alpha Pass" width={33} height={33} />
              <span className="mono">{en ? "Sample data · Stellar Testnet" : "Datos de ejemplo · Stellar Testnet"}</span>
            </header>
            <div className="trust-passport-id">
              <h3 id="sample-passport-heading">{en ? "Digital lot passport" : "Pasaporte digital de lote"}</h3>
              <p className="mono">{lot.id}</p>
              <span>{en ? "Green Arabica coffee" : lot.product} · Jaén, Cajamarca</span>
            </div>
            <dl className="trust-passport-stats">
              <div><dt>{en ? "Eligible plots" : "Parcelas aptas"}</dt><dd className="mono">{eligible.length}/{lot.parcels.length}</dd></div>
              <div><dt>{en ? "Volume" : "Volumen"}</dt><dd className="mono">{bags} {en ? "bags" : "sacos"}</dd></div>
            </dl>
            <div className="trust-passport-proof">
              <span>{en ? "Sample Merkle root" : "Raíz Merkle de ejemplo"}</span>
              <code>{lot.passportRoot?.slice(0, 12)}…{lot.passportRoot?.slice(-8)}</code>
            </div>
            <a className="trust-passport-link" href="#explorar-pasaporte">{en ? "Explore the passport" : "Explorar el pasaporte"} <span aria-hidden="true">↗</span></a>
          </article>
        </div>

        <ol className="trust-route">
          <li>
            <h3>{en ? "Plot" : "Parcela"}</h3>
            <p>{en ? "Georeferenced origin" : "Origen georreferenciado"}</p>
            <span className="mono">{lot.parcels.length} {en ? "plots recorded" : "parcelas registradas"}</span>
          </li>
          <li>
            <h3>{en ? "Satellite evidence" : "Evidencia satelital"}</h3>
            <p>FAO Whisp</p>
            <span className="mono trust-exclusion">{excluded?.id} · {en ? "Alert · excluded" : "Alerta · excluida"}</span>
          </li>
          <li>
            <h3>{en ? "Digital passport" : "Pasaporte digital"}</h3>
            <p>{en ? "Credentials and a Merkle root" : "Credenciales y raíz Merkle"}</p>
            <span className="mono">ACTA · Stellar Testnet</span>
          </li>
          <li>
            <h3>{en ? "Payment" : "Pago"}</h3>
            <p>{en ? "Collection milestone" : "Hito de acopio"}</p>
            <span className="mono">{releasedAmount(lot).toLocaleString(en ? "en-US" : "es-PE")} {lot.escrow?.asset} · {en ? "Simulated" : "Simulado"}</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
