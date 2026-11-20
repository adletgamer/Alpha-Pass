"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MODE } from "@/lib/adapters";
import { useLot } from "@/lib/store";
import { MILESTONE_LABEL, type Milestone } from "@/lib/domain";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import { callTestnet, useTestnetWallet } from "@/components/TestnetWallet";
import { OperationPanel } from "@/components/OperationPanel";
import { ProductHero, ProductMetrics } from "@/components/ProductDisplay";

const ROLES = {
  cooperativa: { label: "Cooperativa · cuenta A", href: "/cooperativa", next: "Verifica las parcelas y ancla el pasaporte con la wallet vinculada a ACTA." },
  importador: { label: "Importador · cuenta B", href: "/importador", next: "Crear y fondear el escrow después de que la cooperativa ancle el pasaporte." },
  verificador: { label: "Verificador", href: "/verificador", next: "Firmar acopio, embarque y llegada en orden. Después vuelve a Importador para liberar el pago de cada hito." },
} as const;

const fmt = (v: string) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default function ProbarPage() {
  return <Suspense fallback={<main className="container product-shell"><ProductHero label="Acceso al producto" title="Prueba Alpha Pass con tu wallet" /></main>}><TestnetGuide /></Suspense>;
}

function TestnetGuide() {
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
  const roleReady = accountExists && (
    role === "cooperativa" ? status?.hasUsdcTrustline : role === "importador" ? buyerReady : verifierReady
  );
  const waiting = busy !== null || connecting || reading;
  const activeStep = !address ? 0 : roleReady ? 2 : 1;

  return (
    <main className="container product-shell">
      <ProductHero label="Acceso al producto" title="Prueba Alpha Pass con tu wallet" description="Prepara una cuenta para operar el lote. Los fondos y las transacciones son de prueba." />

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
            <h2 id="preparar">{address ? "Preparar esta wallet" : "Conecta tu wallet para comenzar"}</h2>
            <span className={`pill ${address ? "pill-ok" : "pill-wait"}`}>{address ? "Conectada" : "Pendiente de conexión"}</span>
          </div>
          {address ? (
            <div className="product-address"><strong>Cuenta activa</strong><code className="mono">{address}</code></div>
          ) : (
            <p className="product-subtitle">Elige Freighter u otra wallet de Stellar. Usarás tu cuenta para confirmar las firmas del flujo de prueba.</p>
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
              <label>Rol que quieres preparar
                <select value={role} onChange={(event) => { setRole(event.target.value as keyof typeof ROLES); setMsg(null); }}>
                  {Object.entries(ROLES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
              </label>
              <ul className="testnet-requirements">
                <li>
                  <div><strong>XLM para comisiones</strong><p>Friendbot fondea la cuenta de prueba.</p></div>
                  <button className="btn" type="button" disabled={!status || waiting || accountExists} onClick={fund}>
                    {accountExists ? "Cuenta fondeada" : busy === "fund" ? "Fondeando…" : "Pedir XLM"}
                  </button>
                </li>
                {role === "cooperativa" && (
                  <li>
                    <div><strong>Recepción en USDC</strong><p>Firma la línea de confianza de Circle para recibir los pagos.</p></div>
                    <button className="btn" type="button" disabled={!accountExists || waiting || status?.hasUsdcTrustline} onClick={() => prepareUsdc("trustline")}>
                      {status?.hasUsdcTrustline ? "Recepción habilitada" : busy === "trustline" ? "Esperando tu firma…" : "Habilitar recepción de USDC"}
                    </button>
                  </li>
                )}
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
              <Link className="btn" href={ROLES[role].href}>Continuar como {role}</Link>
            </div>
          )}
        </section>

        <aside className="card" aria-labelledby="dos-cuentas">
          <h2 id="dos-cuentas">Dos cuentas, una operación</h2>
          <ul className="testnet-account-list">
            <li><strong>Cuenta A · Cooperativa</strong><span className="muted">Ancla el pasaporte y recibe los pagos.</span></li>
            <li><strong>Cuenta B · Importador</strong><span className="muted">Deposita los fondos y solicita cada liberación.</span></li>
          </ul>
          <p className="product-subtitle">Puedes registrar una de las cuentas como verificador. Para cambiar de rol, selecciona la otra cuenta en tu wallet y vuelve a conectar.</p>
        </aside>
      </div>

      {address && <OperationPanel />}
      <section className="card" aria-labelledby="recorrido">
        <div className="product-card-heading">
          <h2 id="recorrido">Del origen al pago</h2>
          {lot.passportRoot && <Link href={`/lote/${lot.id}`}>Ver pasaporte público</Link>}
        </div>
        <ol className="testnet-trail">
          <li><strong>Parcelas</strong><span>La cooperativa consulta el riesgo satelital en Whisp.</span></li>
          <li><strong>Pasaporte</strong><span>La wallet firma la credencial ACTA y el anclaje en LotPassport.</span></li>
          <li><strong>Hitos</strong><span>El verificador atesta acopio, embarque y llegada.</span></li>
          <li><strong>Pago</strong><span>Alpha Pass comprueba la atestación y solicita la liberación en Trustless Work.</span></li>
        </ol>
      </section>
    </main>
  );
}
