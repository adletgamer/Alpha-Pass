/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import Image from "next/image";
import "@/app/home.css";
import "@/app/home-editorial.css";
import { homeCopy, type HomeLocale } from "./home-copy";
import { HomeNav } from "@/components/home/HomeNav";
import { HeroScene } from "@/components/home/HeroScene";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductExplorer } from "@/components/home/ProductExplorer";
import { PartnerRail } from "@/components/home/PartnerRail";
import { TechFlow } from "@/components/home/TechFlow";
import { TrustChain } from "@/components/home/TrustChain";

export function HomePage({ locale }: { locale: HomeLocale }) {
  const copy = homeCopy[locale];
  return (
    <div className="home" lang={locale}>
      <a href="#contenido" className="skip-link">{copy.skip}</a>
      <HomeNav locale={locale} />

      <main id="contenido">
        {/* 02 · Héroe */}
        <HeroScene locale={locale}>
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <h1 id="hero-title" className="hero-title">
            {copy.heroOrigin}
            <br />
            <span>{copy.heroProof}</span>
          </h1>
          <p className="hero-lead">
            {copy.heroLead}
          </p>
          <div className="hero-ctas">
            <a href="#explorar-pasaporte" className="btn btn-lg">{copy.sample}</a>
            <a href="#como-funciona" className="btn btn-ghost btn-lg">{copy.learn}</a>
          </div>
          <p className="demo-note mono">{copy.demoNote}</p>
        </HeroScene>

        {/* 03 · Problema */}
        <section id="plataforma" className="band" aria-labelledby="problema-title">
          <div className="wrap">
            <div className="editorial-heading">
              <div>
                <p className="eyebrow">{copy.problem}</p>
                <h2 id="problema-title" className="section-title">{copy.problemTitle}</h2>
              </div>
              <p className="section-lead">{copy.problemLead}</p>
            </div>
            <div className="compare">
              <div className="compare-col">
                <h3 className="compare-head">{copy.beforeTitle}</h3>
                <ul>{copy.before.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="compare-col is-after">
                <h3 className="compare-head">{copy.afterTitle}</h3>
                <ul>{copy.after.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <TrustChain locale={locale} />

        {/* 04 · Cómo funciona */}
        <section id="como-funciona" className="band band-paper" aria-labelledby="como-title">
          <div className="wrap">
            <p className="eyebrow">{copy.how}</p>
            <h2 id="como-title" className="section-title">{copy.howTitle}</h2>
            <HowItWorks locale={locale} />
          </div>
        </section>

        {/* 05 · Explorar el producto */}
        <section id="explorar" className="band" aria-labelledby="explorar-title">
          <span id="explorar-pasaporte" className="anchor" aria-hidden="true" />
          <div className="wrap">
            <div className="editorial-heading">
              <div>
                <p className="eyebrow">{copy.productEyebrow}</p>
                <h2 id="explorar-title" className="section-title">{copy.productTitle}</h2>
              </div>
              <p className="section-lead">{copy.productLead}</p>
            </div>
            <ProductExplorer locale={locale} />
          </div>
        </section>

        <section className="band ecosystem-band" aria-labelledby="ecosystem-title">
          <div className="wrap">
            <p className="eyebrow">{copy.ecosystemEyebrow}</p>
            <h2 id="ecosystem-title" className="section-title">{copy.ecosystemTitle}</h2>
            <p className="section-lead">{copy.ecosystemLead}</p>
            <PartnerRail locale={locale} />
          </div>
        </section>

        {/* 06 · Confianza y tecnología */}
        <section id="tecnologia" className="band band-green" aria-labelledby="tecnologia-title">
          <div className="wrap">
            <p className="eyebrow">{copy.technology}</p>
            <h2 id="tecnologia-title" className="section-title">{copy.techTitle}</h2>
            <p className="section-lead">{copy.techLead}</p>
            <TechFlow locale={locale} />
          </div>
        </section>

        {/* 07 · Para cada participante */}
        <section className="band" aria-label={copy.audience}>
          <div className="wrap audience">
            <figure className="origin-photo">
              <Image src="/home/coffee-cherries.webp" alt={copy.coffeeAlt} fill sizes="(max-width: 760px) 92vw, 36vw" />
              <figcaption className="mono">{copy.coffeeCaption}</figcaption>
            </figure>
            <article id="cooperativas" className="audience-col" aria-labelledby="coop-title">
              <p className="eyebrow">{copy.coopEyebrow}</p>
              <h2 id="coop-title" className="audience-title">{copy.coopTitle}</h2>
              <ul className="checks">
                {copy.coopChecks.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Link href="/cooperativa" className="btn btn-ghost">{copy.coopLink}</Link>
            </article>
            <article id="importadores" className="audience-col" aria-labelledby="imp-title">
              <p className="eyebrow">{copy.buyerEyebrow}</p>
              <h2 id="imp-title" className="audience-title">{copy.buyerTitle}</h2>
              <ul className="checks">
                {copy.buyerChecks.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Link href="/importador" className="btn btn-ghost">{copy.buyerLink}</Link>
            </article>
          </div>
          <p className="wrap disclaimer">
            {copy.disclaimer}
          </p>
        </section>

        {/* 08 · Llamado final */}
        <section className="band band-green final" aria-labelledby="final-title">
          <div className="wrap final-inner">
            <h2 id="final-title" className="section-title">{copy.finalTitle}</h2>
            <p className="section-lead">{copy.finalLead}</p>
            <div className="hero-ctas">
              <a href="#explorar" className="btn btn-light btn-lg">{copy.demoCta}</a>
              <a href="https://github.com/adletgamer/Alpha-Pass" className="btn btn-outline-light btn-lg" rel="noopener">{copy.github}</a>
            </div>
          </div>
        </section>
      </main>

      {/* 09 · Pie */}
      <footer className="home-footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <img src="/brand/alpha-pass-logo-horizontal.png" alt="Alpha Pass · Verified origin infrastructure" width={200} height={44} />
            <p className="mono">{copy.demoNote}</p>
          </div>
          <nav aria-label={copy.platform} className="footer-nav">
            <a href="#como-funciona">{copy.how}</a>
            <a href="#cadena-de-confianza">{copy.trustChain}</a>
            <a href="#explorar">{copy.product}</a>
            <a href="#tecnologia">{copy.technology}</a>
            <Link href="/cooperativa">{copy.cooperative}</Link>
            <Link href="/importador">{copy.importer}</Link>
            <Link href="/verificador">{copy.verifier}</Link>
            <Link href="/lote/2026-JAE-014">{copy.publicPassport}</Link>
          </nav>
        </div>
        <p className="wrap footer-legal">{copy.legal}</p>
      </footer>
    </div>
  );
}
