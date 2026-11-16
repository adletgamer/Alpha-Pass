"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { MODE } from "@/lib/adapters";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/cooperativa", label: "Cooperativa" },
  { href: "/importador", label: "Importador" },
  { href: "/verificador", label: "Verificador" },
  { href: "/lote/2026-JAE-014", label: "Pasaporte público" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <>
      {MODE === "demo" && (
        <div className="demo-banner">Modo demo: datos de ejemplo y servicios simulados. Nada se envía a Stellar.</div>
      )}
      {MODE === "testnet" && (
        <div className="demo-banner">Stellar Testnet: transacciones reales de prueba, sin dinero real.</div>
      )}
      <header className="site">
        <div className="inner">
          <Link href="/" aria-label="Alpha Pass, inicio" style={{ textDecoration: "none" }}>
            <Logo />
          </Link>
          <nav className="site-nav" aria-label="Vistas por rol">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
            <WalletButton />
          </nav>
        </div>
      </header>
    </>
  );
}
