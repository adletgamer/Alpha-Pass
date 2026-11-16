/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import "./home.css";
import { HomeNav } from "@/components/home/HomeNav";
import { HeroScene } from "@/components/home/HeroScene";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductExplorer } from "@/components/home/ProductExplorer";
import { TechFlow } from "@/components/home/TechFlow";

const DESCRIPTION =
  "Alpha Pass conecta la evidencia de origen de lotes de café y cacao del Perú con pagos internacionales liberados por hitos, sobre Stellar.";

export const metadata: Metadata = {
  title: { absolute: "Alpha Pass · Cada lote con su origen, cada pago con su prueba" },
  description: DESCRIPTION,
  openGraph: {
    title: "Alpha Pass · Verified Origin Infrastructure",
    description: DESCRIPTION,
    type: "website",
    locale: "es_PE",
    images: [{ url: "/brand/alpha-pass-logo-horizontal.png", width: 532, height: 116, alt: "Alpha Pass" }],
  },
  twitter: { card: "summary", title: "Alpha Pass · Verified Origin Infrastructure", description: DESCRIPTION },
};

const BEFORE = [
  "Evidencia repartida en documentos sueltos",
  "Datos de parcelas en sistemas distintos",
  "Pago incierto hasta después del embarque",
  "Verificación manual, caso por caso",
];
const AFTER = [
  "Un pasaporte por lote",
  "Evidencia firmada por quien la emite",
  "Verificación compartida por las dos partes",
  "Pagos liberados contra pruebas",
];

export default function Home() {
  return (
    <div className="home">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <HomeNav />

      <main id="contenido">
        {/* 02 · Héroe */}
        <HeroScene>
          <p className="eyebrow">Verified origin infrastructure</p>
          <h1 id="hero-title" className="hero-title">
            Cada lote con su origen.
            <br />
            Cada pago con su prueba.
          </h1>
          <p className="hero-lead">
            El pasaporte verificable que conecta la evidencia de origen con pagos internacionales liberados por hitos.
          </p>
          <div className="hero-ctas">
            <a href="#explorar-pasaporte" className="btn btn-lg">Explorar pasaporte de ejemplo</a>
            <a href="#como-funciona" className="btn btn-ghost btn-lg">Conocer cómo funciona</a>
          </div>
          <p className="demo-note mono">Demo en Stellar Testnet · Datos de ejemplo</p>
        </HeroScene>

        {/* 03 · Problema */}
        <section id="plataforma" className="band" aria-labelledby="problema-title">
          <div className="wrap">
            <p className="eyebrow">El problema</p>
            <h2 id="problema-title" className="section-title">El origen y el dinero no deberían viajar por separado.</h2>
            <p className="section-lead">
              La exportadora necesita seguridad de cobro. El importador necesita evidencia de origen que pueda verificar.
              Hoy cada necesidad se resuelve por su lado, con papeles distintos y en momentos distintos.
            </p>
            <div className="compare">
              <div className="compare-col">
                <h3 className="compare-head">Antes</h3>
                <ul>{BEFORE.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
              <div className="compare-arrow" aria-hidden="true">
                <svg viewBox="0 0 48 24" width="48" height="24"><path d="M2 12h40m-8-8 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </div>
              <div className="compare-col is-after">
                <h3 className="compare-head">Con Alpha Pass</h3>
                <ul>{AFTER.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        {/* 04 · Cómo funciona */}
        <section id="como-funciona" className="band band-paper" aria-labelledby="como-title">
          <div className="wrap">
            <p className="eyebrow">Cómo funciona</p>
            <h2 id="como-title" className="section-title">Una operación. Evidencia verificable. Pagos por hitos.</h2>
            <HowItWorks />
          </div>
        </section>

        {/* 05 · Explorar el producto */}
        <section id="explorar" className="band" aria-labelledby="explorar-title">
          <span id="explorar-pasaporte" className="anchor" aria-hidden="true" />
          <div className="wrap">
            <p className="eyebrow">El producto</p>
            <h2 id="explorar-title" className="section-title">Descubre cómo funciona Alpha Pass.</h2>
            <p className="section-lead">Las mismas pantallas del prototipo, con el lote de ejemplo 2026-JAE-014 de Jaén, Cajamarca.</p>
            <ProductExplorer />
          </div>
        </section>

        {/* 06 · Confianza y tecnología */}
        <section id="tecnologia" className="band band-green" aria-labelledby="tecnologia-title">
          <div className="wrap">
            <p className="eyebrow">Tecnología</p>
            <h2 id="tecnologia-title" className="section-title">Confianza respaldada por evidencia.</h2>
            <p className="section-lead">Cinco herramientas, un solo flujo. Cada una cumple un papel concreto en la operación.</p>
            <TechFlow />
          </div>
        </section>

        {/* 07 · Para cada participante */}
        <section className="band" aria-label="Para cada participante">
          <div className="wrap audience">
            <article id="cooperativas" className="audience-col" aria-labelledby="coop-title">
              <p className="eyebrow">Para cooperativas y exportadoras</p>
              <h2 id="coop-title" className="audience-title">Tu lote tiene un origen. Tu trabajo merece un pago respaldado.</h2>
              <ul className="checks">
                <li>Pasaportes de lote estructurados</li>
                <li>Evidencia ligada a cada parcela y productor</li>
                <li>Visibilidad del pago desde el depósito</li>
                <li>Menos dependencia de documentos sueltos</li>
                <li>Estado de cada hito, a la vista</li>
              </ul>
              <Link href="/cooperativa" className="btn btn-ghost">Ver la vista de cooperativa</Link>
            </article>
            <article id="importadores" className="audience-col" aria-labelledby="imp-title">
              <p className="eyebrow">Para compradores internacionales</p>
              <h2 id="imp-title" className="audience-title">Compra con evidencia. Libera pagos contra pruebas.</h2>
              <ul className="checks">
                <li>Evidencia estructurada por lote</li>
                <li>Información trazable de cada parcela</li>
                <li>Credenciales firmadas y verificables</li>
                <li>Pago en escrow, liberado por hitos</li>
                <li>Paquete de evidencias exportable para la debida diligencia</li>
              </ul>
              <Link href="/importador" className="btn btn-ghost">Ver la vista de importador</Link>
            </article>
          </div>
          <p className="wrap disclaimer">
            Alpha Pass organiza la evidencia y apoya la debida diligencia del comprador. No es una autoridad de certificación
            ni garantiza la aprobación bajo la normativa europea sobre deforestación (EUDR).
          </p>
        </section>

        {/* 08 · Llamado final */}
        <section className="band band-green final" aria-labelledby="final-title">
          <div className="wrap final-inner">
            <h2 id="final-title" className="section-title">El comercio internacional necesita confianza verificable.</h2>
            <p className="section-lead">Conecta el origen, la evidencia y el pago en una sola operación.</p>
            <div className="hero-ctas">
              <Link href="/cooperativa" className="btn btn-light btn-lg">Explorar Alpha Pass</Link>
              <a href="https://github.com/adletgamer/Alpha-Pass" className="btn btn-outline-light btn-lg" rel="noopener">Ver el código en GitHub</a>
            </div>
          </div>
        </section>
      </main>

      {/* 09 · Pie */}
      <footer className="home-footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <img src="/brand/alpha-pass-logo-horizontal.png" alt="Alpha Pass · Verified origin infrastructure" width={200} height={44} />
            <p className="mono">Demo en Stellar Testnet · Datos de ejemplo</p>
          </div>
          <nav aria-label="Plataforma" className="footer-nav">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#explorar">Producto</a>
            <a href="#tecnologia">Tecnología</a>
            <Link href="/cooperativa">Cooperativa</Link>
            <Link href="/importador">Importador</Link>
            <Link href="/verificador">Verificador</Link>
            <Link href="/lote/2026-JAE-014">Pasaporte público</Link>
          </nav>
        </div>
        <p className="wrap footer-legal">Prototipo para Stellar Codember Perú 2026.</p>
      </footer>
    </div>
  );
}
