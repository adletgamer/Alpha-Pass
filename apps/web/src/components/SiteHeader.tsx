"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { MODE } from "@/lib/adapters";
import { WalletButton } from "./WalletButton";
import { useLot } from "@/lib/store";

export function SiteHeader() {
  const path = usePathname();
  const samplePassport = path === "/lote/ejemplo";
  const { lot } = useLot();
  const LINKS = [
    ...(MODE === "testnet" ? [{ href: "/probar", label: "Probar en Testnet" }] : []),
    { href: "/cooperativa", label: "Cooperativa" },
    { href: "/importador", label: "Importador" },
    { href: "/verificador", label: "Verificador" },
    { href: `/lote/${lot.id}`, label: "Pasaporte público" },
  ];
  return (
    <>
      {samplePassport ? (
        <div className="demo-banner">Pasaporte de ejemplo · Datos y pagos simulados.</div>
      ) : MODE === "demo" ? (
        <div className="demo-banner">Modo demo: datos de ejemplo y servicios simulados. Nada se envía a Stellar.</div>
      ) : (
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
            {!samplePassport && <WalletButton />}
          </nav>
        </div>
      </header>
    </>
  );
}
