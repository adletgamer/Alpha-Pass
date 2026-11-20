"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { MODE } from "@/lib/adapters";
import { WalletButton } from "./WalletButton";
import { useLot } from "@/lib/store";
import { PUBLIC_TESTNET_LOT_PATH } from "@/lib/sample-data";
import { useTestnetWallet } from "./TestnetWallet";

export function SiteHeader() {
  const path = usePathname();
  const { lot } = useLot();
  const { address } = useTestnetWallet();
  const LINKS = [
    ...(MODE === "testnet" ? [{ href: "/probar", label: "Probar en Testnet" }] : []),
    { href: "/cooperativa", label: "Cooperativa" },
    { href: "/importador", label: "Importador" },
    { href: "/verificador", label: "Verificador" },
    { href: lot.passportRoot ? `/lote/${lot.id}` : PUBLIC_TESTNET_LOT_PATH, label: "Pasaporte público" },
  ];
  return (
    <>
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
            {address && path !== "/probar" && !path.startsWith("/lote/") && <WalletButton />}
          </nav>
        </div>
      </header>
    </>
  );
}
