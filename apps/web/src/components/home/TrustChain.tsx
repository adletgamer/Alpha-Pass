import Image from "next/image";
import Link from "next/link";
import { exampleLot } from "@/lib/example-lot";
import { releasedAmount } from "@/lib/release-gate";
import { PUBLIC_TESTNET_LOT_PATH } from "@/lib/sample-data";
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
            {en ? "Check the lot’s origin evidence against its passport. A signed attestation unlocks each milestone payment." : "Comprueba la evidencia de origen con el pasaporte. Una atestación firmada habilita el pago de cada hito."}
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
              <span className="mono">{en ? "Illustrative data" : "Datos ilustrativos"}</span>
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
            <Link className="trust-passport-link" href={PUBLIC_TESTNET_LOT_PATH}>{en ? "View a lot anchored on Testnet" : "Ver un lote anclado en Testnet"} <span aria-hidden="true">↗</span></Link>
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
