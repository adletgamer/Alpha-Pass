"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MODE } from "@/lib/adapters";
import { useLot } from "@/lib/store";
import { MILESTONE_LABEL, type Milestone } from "@/lib/domain";
import { TESTNET_ESCROW_AMOUNT, TESTNET_IMPORTER_LOT_ID } from "@/lib/sample-data";
import { callTestnet, useTestnetWallet } from "@/components/TestnetWallet";
import { OperationPanel } from "@/components/OperationPanel";
import { ProductHero, ProductMetrics } from "@/components/ProductDisplay";

const ROLES = {
  cooperativa: { label: "Cooperativa", href: "/testnet/cooperativa", next: "Evalúa las parcelas con Whisp y firma su anclaje en LotPassport." },
  importador: { label: "Importador", href: "/testnet/importador", next: "Fondea un escrow y libera pagos sobre un lote con atestaciones confirmadas." },
  verificador: { label: "Verificador de equipo", href: "/verificador", next: "Firma acopio, embarque y llegada en la operación compartida." },
} as const;

const fmt = (v: string) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default function TestnetPage() {
  return (
    <Suspense fallback={<main className="container product-shell"><ProductHero label="Entorno de integración" title="Alpha Pass en Stellar Testnet" /></main>}>
      <TestnetWorkspace />
    </Suspense>
  );
}

function TestnetWorkspace() {
  const { lot } = useLot();
  const { address, status, connecting, reading, error: walletError, connect, refresh } = useTestnetWallet();
  const requestedRole = useSearchParams().get("rol");
  const [role, setRole] = useState<keyof typeof ROLES>(requestedRole === "importador" || requestedRole === "verificador" ? requestedRole : "cooperativa");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function step(name: string, fn: (account: string) => Promise<string>) {
    if (!address) return;
    setBusy(name);
    setMsg(null);
    try {
      const { currentAddress } = await import("@/lib/wallet");
      if (await currentAddress() !== address) {
        throw new Error("Cambiaste de cuenta. Pulsa «Cambiar cuenta» y comprueba la dirección antes de continuar.");
      }
      setMsg({ kind: "ok", text: await fn(address) });
      refresh();
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const fund = () =>
    step("fund", async (account) => {
      const r = await callTestnet<{ funded: boolean }>({ action: "fund", address: account });
      return r.funded ? "Listo: friendbot depositó 10 000 XLM de prueba." : "La cuenta ya existía en Testnet.";
    });

  const prepareUsdc = (action: "usdc" | "trustline") =>
    step(action, async (account) => {
      const { signXdr } = await import("@/lib/wallet");
      const { unsignedXdr } = await callTestnet<{ unsignedXdr: string }>({ action, address: account });
      const signedXdr = await signXdr(unsignedXdr, { expectedAddress: account });
      const { hash } = await callTestnet<{ hash: string }>({ action: "submit", signedXdr });
      if (action === "trustline") return "Recepción de USDC de prueba habilitada.";
      return `Listo: 200 USDC de prueba en tu cuenta (tx ${hash.slice(0, 10)}…).`;
    });

  const verifier = () =>
    step("verifier", async (account) => {
      const r = await callTestnet<{ registered: Milestone[] }>({ action: "verifier", address: account });
      return r.registered.length ? "Listo: tu wallet puede firmar los tres hitos en LotPassport." : "Tu wallet ya era verificadora.";
    });

  if (MODE !== "testnet") {
    return (
      <main className="container product-shell">
        <ProductHero label="Acceso al producto" title="Testnet no disponible" description="Este despliegue necesita configuración de Stellar Testnet para habilitar las operaciones." />
        <div><Link className="btn btn-ghost" href="/#explorar">Ver las vistas del producto</Link></div>
      </main>
    );
  }

  const accountExists = Boolean(status?.exists);
  const buyerReady = Boolean(status?.hasUsdcTrustline && Number(status.usdc) >= TESTNET_ESCROW_AMOUNT);
  const verifierReady = status?.verifierFor.length === 3;
  const roleReady = accountExists && (role === "cooperativa" || (role === "importador" ? buyerReady : verifierReady));
  const waiting = busy !== null || connecting || reading;
  const activeStep = !address ? 0 : roleReady ? 2 : 1;

  return (
    <main className="container product-shell">
      <ProductHero label="Entorno de integración" title="Alpha Pass en Stellar Testnet" description="Selecciona Cooperativa o Importador y conecta tu wallet para validar transacciones en Stellar Testnet." />

      <fieldset className="testnet-role-picker">
        <legend>Rol de operación</legend>
        {(["cooperativa", "importador", ...(role === "verificador" ? ["verificador"] : [])] as (keyof typeof ROLES)[]).map((value) => (
          <label key={value} className="testnet-role-choice">
            <input type="radio" name="testnet-role" checked={role === value} disabled={waiting} onChange={() => { setRole(value); setMsg(null); }} />
            <span><strong>{ROLES[value].label}</strong><small>{ROLES[value].next}</small></span>
          </label>
        ))}
      </fieldset>

      <ol className="testnet-steps" aria-label="Progreso de preparación">
        {["Conectar wallet", "Preparar cuenta", "Entrar a la operación"].map((label, index) => (
          <li key={label} aria-current={index === activeStep ? "step" : undefined}>
            <span className="mono" aria-hidden="true">0{index + 1}</span><strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="testnet-layout">
        <section className="card" aria-labelledby="preparar">
          <div className="product-card-heading">
            <h2 id="preparar">{address ? `Preparar wallet de ${ROLES[role].label.toLowerCase()}` : "Conexión de wallet"}</h2>
            <span className={`pill ${address ? "pill-ok" : "pill-wait"}`}>{address ? "Conectada" : "Pendiente de conexión"}</span>
          </div>
          {address ? (
            <div className="product-address"><strong>Cuenta activa</strong><code className="mono">{address}</code></div>
          ) : (
            <p className="product-subtitle">Conecta Freighter u otra wallet de Stellar para firmar las transacciones de tu rol.</p>
          )}
          <div>
            <button className={address ? "btn btn-ghost" : "btn"} type="button" disabled={waiting} onClick={() => { setMsg(null); void connect(); }}>
              {connecting ? "Conectando…" : address ? "Cambiar cuenta" : "Conectar wallet"}
            </button>
          </div>
          {walletError && <p className="error product-subtitle" role="alert">{walletError}</p>}
          {reading && <p className="product-subtitle" role="status">Consultando saldo y permisos en Stellar Testnet…</p>}
          {status && (
            <ProductMetrics label="Estado de la cuenta" items={[
              { label: "XLM de prueba", value: status.exists ? fmt(status.xlm) : "Nueva" },
              { label: "USDC de prueba", value: status.hasUsdcTrustline ? fmt(status.usdc) : "—", note: status.hasUsdcTrustline ? undefined : "Línea de confianza pendiente" },
              { label: "Hitos habilitados", value: `${status.verifierFor.length}/3`, note: status.verifierFor.length ? status.verifierFor.map((m) => MILESTONE_LABEL[m]).join(", ") : undefined },
            ]} />
          )}
          {address && (
            <>
              <ul className="testnet-requirements">
                <li>
                  <div><strong>XLM para comisiones</strong><p>Friendbot fondea la cuenta de prueba.</p></div>
                  <button className="btn" type="button" disabled={!status || waiting || accountExists} onClick={fund}>
                    {accountExists ? "Cuenta fondeada" : busy === "fund" ? "Fondeando…" : "Pedir XLM"}
                  </button>
                </li>
                {role === "importador" && (
                  <li>
                    <div><strong>Saldo para fondear el escrow</strong><p>Necesitas {TESTNET_ESCROW_AMOUNT} USDC de prueba. La firma cambia XLM de prueba por 200 USDC.</p></div>
                    <button className="btn" type="button" disabled={!accountExists || waiting || buyerReady} onClick={() => prepareUsdc("usdc")}>
                      {buyerReady ? "Saldo suficiente" : busy === "usdc" ? "Esperando tu firma…" : "Obtener 200 USDC de prueba"}
                    </button>
                  </li>
                )}
                {role === "verificador" && (
                  <li>
                    <div><strong>Permiso en LotPassport</strong><p>Registra la cuenta para firmar acopio, embarque y llegada.</p></div>
                    <button className="btn" type="button" disabled={!accountExists || waiting || verifierReady} onClick={verifier}>
                      {verifierReady ? "Permisos confirmados" : busy === "verifier" ? "Registrando…" : "Registrar verificador de prueba"}
                    </button>
                  </li>
                )}
              </ul>
            </>
          )}
          {msg && <p className={msg.kind === "error" ? "error" : "product-subtitle"} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}
          {address && !status && !waiting && <div><button className="btn btn-ghost" type="button" onClick={refresh}>Volver a consultar la cuenta</button></div>}
          {roleReady && (
            <div className="testnet-ready">
              <p><strong>Cuenta preparada.</strong> {ROLES[role].next}</p>
              <Link className="btn" href={ROLES[role].href}>Entrar como {ROLES[role].label}</Link>
            </div>
          )}
        </section>

        <aside className="card" aria-labelledby="alcance-validacion">
          <h2 id="alcance-validacion">Alcance de la validación</h2>
          <ul className="testnet-account-list">
            {role === "cooperativa" ? (
              <>
                <li><strong>Evaluación en Whisp</strong><span className="muted">Revisa el riesgo de las parcelas del lote de prueba.</span></li>
                <li><strong>Pasaporte en Stellar</strong><span className="muted">Firma la raíz Merkle y consulta el registro público.</span></li>
              </>
            ) : role === "importador" ? (
              <>
                <li><strong>Contraparte registrada</strong><span className="muted">El lote de referencia ya tiene cooperativa y tres atestaciones en LotPassport.</span></li>
                <li><strong>Escrow en USDC de prueba</strong><span className="muted">Firma el fondeo y comprueba las liberaciones por hito.</span><Link href={`/lote/${TESTNET_IMPORTER_LOT_ID}`}>Ver lote de referencia</Link></li>
              </>
            ) : (
              <li><strong>Atestaciones en LotPassport</strong><span className="muted">Abre el enlace del verificador de una operación compartida.</span></li>
            )}
          </ul>
        </aside>
      </div>

      <details className="card testnet-team">
        <summary>Operación compartida</summary>
        <p className="product-subtitle">Para trabajar sobre el mismo lote, la cooperativa y el importador usan sus propias cuentas. La emisión ACTA requiere la wallet vinculada a la clave del entorno.</p>
        {address && <>
          <OperationPanel />
          <div className="product-inline-actions">
            <Link href="/cooperativa">Vista de cooperativa</Link>
            <Link href="/importador">Vista de importador</Link>
            <button className="btn btn-ghost" type="button" disabled={waiting} onClick={() => { setRole("verificador"); setMsg(null); }}>Preparar verificador</button>
            <button className="btn btn-ghost" type="button" disabled={!accountExists || waiting || status?.hasUsdcTrustline} onClick={() => prepareUsdc("trustline")}>
              {status?.hasUsdcTrustline ? "Recepción de USDC habilitada" : "Habilitar recepción de USDC"}
            </button>
          </div>
          {lot.passportRoot && <Link href={`/lote/${lot.id}`}>Ver pasaporte público</Link>}
        </>}
      </details>
    </main>
  );
}
