"use client";

import Link from "next/link";
import { useTestnetWallet } from "@/components/TestnetWallet";
import { WalletButton } from "@/components/WalletButton";
import { MODE } from "@/lib/adapters";

export default function OperationLayout({ children }: { children: React.ReactNode }) {
  const { address } = useTestnetWallet();
  if (MODE === "testnet" && address) return children;

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <section className="card">
        <span className="muted mono">Stellar Testnet</span>
        {MODE === "testnet" ? (
          <>
            <h1>Conecta tu wallet de Stellar</h1>
            <p className="muted" style={{ margin: 0 }}>Usa tu wallet para entrar al flujo de prueba y firmar las transacciones de tu rol.</p>
            <div className="row" style={{ alignItems: "center", gap: 12 }}>
              <WalletButton />
              <Link href="/probar">Preparar mi cuenta de Testnet</Link>
            </div>
          </>
        ) : (
          <>
            <h1>Testnet no disponible</h1>
            <p className="muted" style={{ margin: 0 }}>Este despliegue aún no está configurado para operar con una wallet.</p>
            <Link href="/#explorar">Ver las vistas del producto</Link>
          </>
        )}
      </section>
    </main>
  );
}
