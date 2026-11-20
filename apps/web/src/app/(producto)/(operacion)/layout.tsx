"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTestnetWallet } from "@/components/TestnetWallet";
import { WalletButton } from "@/components/WalletButton";
import { MODE } from "@/lib/adapters";
import { ProductHero } from "@/components/ProductDisplay";

export default function OperationLayout({ children }: { children: React.ReactNode }) {
  const { address } = useTestnetWallet();
  const path = usePathname();
  if (MODE === "testnet" && address) return children;
  const role = path.startsWith("/testnet/") ? path.split("/")[2] : undefined;
  const setupHref = role === "importador" || role === "cooperativa" ? `/testnet?rol=${role}` : "/testnet";

  return (
    <main className="container product-shell">
      <ProductHero
        label="Acceso a la operación"
        title={MODE === "testnet" ? "Conecta tu wallet de Stellar" : "Testnet no disponible"}
        description={MODE === "testnet"
          ? "Tu wallet identifica la cuenta con la que vas a operar el lote y firmar las transacciones de prueba."
          : "Este despliegue necesita configuración de Stellar Testnet para habilitar las operaciones."}
      />
      <section className="card">
        {MODE === "testnet" ? (
          <>
            <h2>Cuenta de Testnet</h2>
            <div className="product-inline-actions">
              <WalletButton />
              <Link className="btn btn-ghost" href={setupHref}>Preparar mi cuenta</Link>
            </div>
          </>
        ) : (
          <div><Link className="btn btn-ghost" href="/#explorar">Ver las vistas del producto</Link></div>
        )}
      </section>
    </main>
  );
}
