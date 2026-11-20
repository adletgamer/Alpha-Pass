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
  const inTestnetRole = path.startsWith("/testnet/");
  const { lot } = useLot();
  const { address } = useTestnetWallet();
  const LINKS = [
    ...(MODE === "testnet" ? [{ href: "/testnet", label: "Entorno Testnet" }] : []),
    { href: "/cooperativa", label: "Cooperativa" },
    { href: "/importador", label: "Importador" },
    { href: "/verificador", label: "Verificador" },
    { href: lot.passportRoot ? `/lote/${lot.id}` : PUBLIC_TESTNET_LOT_PATH, label: "Pasaporte público" },
  ];
  return (
    <>
      {MODE === "testnet" && (
        <div className="site-network"><strong>Stellar Testnet</strong><span>Transacciones de prueba</span></div>
      )}
      <header className="site">
        <div className="inner">
          <Link href="/" aria-label="Alpha Pass, inicio" style={{ textDecoration: "none" }}>
            <Logo size={32} />
          </Link>
          <nav className="site-nav" aria-label="Vistas por rol">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : l.href === "/testnet" && inTestnetRole ? "location" : undefined}>
                {l.label}
              </Link>
            ))}
            {address && path !== "/testnet" && !path.startsWith("/lote/") && <WalletButton />}
          </nav>
        </div>
      </header>
    </>
  );
}
