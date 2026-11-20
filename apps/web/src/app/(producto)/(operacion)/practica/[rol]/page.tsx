"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductHero } from "@/components/ProductDisplay";
import { useTestnetWallet } from "@/components/TestnetWallet";
import type { Lot } from "@/lib/domain";
import { LotProvider } from "@/lib/store";
import { TESTNET_IMPORTER_LOT_ID } from "@/lib/sample-data";
import { importerPracticeLot } from "@/lib/testnet-practice";
import CooperativaPage from "../../cooperativa/page";
import ImportadorPage from "../../importador/page";

function ImporterPractice({ address }: { address: string }) {
  const [state, setState] = useState<{ lot?: Lot; error?: string }>({});
  const [request, retry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/lote/${encodeURIComponent(TESTNET_IMPORTER_LOT_ID)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar el lote de referencia de Testnet.");
        const lot = importerPracticeLot(await response.json(), TESTNET_IMPORTER_LOT_ID);
        if (address === lot.cooperative) throw new Error("Esta cuenta pertenece a la cooperativa de referencia. Conecta la cuenta del importador.");
        setState({ lot });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState({ error: error.message });
      });
    return () => controller.abort();
  }, [address, request]);

  if (state.lot) {
    return (
      <LotProvider initial={state.lot} practice={{ role: "importador", address, counterparty: state.lot.cooperative }}>
        <ImportadorPage />
      </LotProvider>
    );
  }
  return (
    <main className="container product-shell">
      <ProductHero label="Importador" title="Lote de referencia" description="Importa una operación de prueba con pasaporte y atestaciones confirmados en Stellar." />
      <section className="card">
        <p className={state.error ? "error" : "product-subtitle"} role={state.error ? "alert" : "status"}>
          {state.error ?? "Comprobando el pasaporte y las atestaciones en Stellar Testnet…"}
        </p>
        {state.error && <div className="product-inline-actions">
          <button type="button" className="btn" onClick={() => { setState({}); retry((value) => value + 1); }}>Volver a consultar</button>
          <Link className="btn btn-ghost" href="/probar?rol=importador">Volver a Testnet</Link>
        </div>}
      </section>
    </main>
  );
}

export default function PracticePage({ params }: { params: Promise<{ rol: string }> }) {
  const { rol } = use(params);
  const { address } = useTestnetWallet();
  if (rol !== "cooperativa" && rol !== "importador") notFound();
  if (!address) return null;
  if (rol === "importador") return <ImporterPractice key={address} address={address} />;
  return <LotProvider key={address} practice={{ role: rol, address }}><CooperativaPage /></LotProvider>;
}
