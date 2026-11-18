"use client";

import type { HomeLocale } from "./home-copy";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#plataforma", label: "Plataforma" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#cooperativas", label: "Para cooperativas" },
  { href: "#importadores", label: "Para importadores" },
];

const LINKS_EN = [
  { href: "#plataforma", label: "Platform" },
  { href: "#como-funciona", label: "How it works" },
  { href: "#cooperativas", label: "For cooperatives" },
  { href: "#importadores", label: "For importers" },
];

export function HomeNav({ locale }: { locale: HomeLocale }) {
  const links = locale === "en" ? LINKS_EN : LINKS;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`home-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="home-nav-inner">
        <a href="#inicio" className="home-nav-logo" aria-label={locale === "en" ? "Alpha Pass, back to top" : "Alpha Pass, ir al inicio"}>
          <img src="/brand/alpha-pass-logo-horizontal.png" alt="Alpha Pass · Verified origin infrastructure" width={186} height={41} />
        </a>
        <nav aria-label={locale === "en" ? "Page sections" : "Secciones de la página"} className="home-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <div className="home-nav-actions">
          <nav className="home-language" aria-label={locale === "en" ? "Language" : "Idioma"}>
            <Link href="/" hrefLang="es" lang="es" aria-label="Español" aria-current={locale === "es" ? "page" : undefined}>ES</Link>
            <Link href="/en" hrefLang="en" lang="en" aria-label="English" aria-current={locale === "en" ? "page" : undefined}>EN</Link>
          </nav>
          <Link href="/cooperativa" className="btn">{locale === "en" ? "Explore demo" : "Explorar demo"}</Link>
          <button
            type="button"
            className="home-nav-toggle"
            aria-expanded={open}
            aria-controls="home-nav-mobile"
            aria-label={open ? (locale === "en" ? "Close menu" : "Cerrar menú") : (locale === "en" ? "Open menu" : "Abrir menú")}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      <nav id="home-nav-mobile" aria-label={locale === "en" ? "Page sections" : "Secciones de la página"} className="home-nav-mobile" hidden={!open}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
        ))}
        <Link href="/cooperativa" className="btn" onClick={() => setOpen(false)}>{locale === "en" ? "Explore demo" : "Explorar demo"}</Link>
      </nav>
    </header>
  );
}
