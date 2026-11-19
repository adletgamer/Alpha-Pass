"use client";

import { useState } from "react";
import Link from "next/link";
import { MODE } from "@/lib/adapters";
import { useLot } from "@/lib/store";
import { MILESTONE_LABEL, type Milestone } from "@/lib/domain";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import { callTestnet, useTestnetWallet } from "@/components/TestnetWallet";
import { OperationPanel } from "@/components/OperationPanel";

const ROLES = {
  cooperativa: { label: "Cooperativa · cuenta A", href: "/cooperativa", next: "Verifica las parcelas y ancla el pasaporte con la wallet vinculada a ACTA." },
  importador: { label: "Importador · cuenta B", href: "/importador", next: "Crear y fondear el escrow después de que la cooperativa ancle el pasaporte." },
  verificador: { label: "Verificador", href: "/verificador", next: "Firmar acopio, embarque y llegada en orden. Después vuelve a Importador para liberar el pago de cada hito." },
} as const;

const fmt = (v: string) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default function ProbarPage() {
  const { lot } = useLot();
  const { address, status, connecting, reading, connect, refresh } = useTestnetWallet();
  const [role, setRole] = useState<keyof typeof ROLES>("cooperativa");
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
      <main className="container">
        <h1>Probar en Testnet</h1>
        <p className="muted">Esta página solo está activa cuando la app corre en modo Testnet.</p>
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
  return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div>
        <div className="muted">Stellar Testnet · sin dinero real</div>
        <h1>Prueba el flujo completo con tu wallet</h1>
        <p>Prepara dos cuentas Stellar en Testnet. La cuenta A cobra y la cuenta B deposita. Puedes registrar una de ellas como verificador de prueba.</p>
        <Link href="/#explorar">Probar sin wallet en la simulación</Link>
      </div>

      <section className="card" aria-labelledby="dos-cuentas">
        <h2 id="dos-cuentas">Vas a necesitar dos cuentas</h2>
        <p style={{ margin: 0 }}>
          El escrow no deja que la misma wallet pague y cobre. Usa una cuenta como <strong>cooperativa</strong> (ancla el lote y recibe los pagos)
          y otra como <strong>importador</strong> (deposita el pago). En Freighter puedes crear una segunda cuenta en el mismo navegador:
          cambia de cuenta y vuelve a pulsar &quot;Conectar wallet&quot;. Prepara cada cuenta con esta página.
        </p>
      </section>

      <section className="card" aria-labelledby="preparar">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 id="preparar">Preparar esta wallet</h2>
          <button className={address ? "btn btn-ghost" : "btn"} type="button" disabled={waiting} onClick={() => { setMsg(null); void connect(); }}>
            {address ? "Cambiar cuenta" : "Conectar wallet"}
          </button>
        </div>
        {address && (
          <div style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>Cuenta activa: <span className="mono">{address}</span></div>
        )}
        {reading && <p role="status">Consultando saldo y permisos en Stellar Testnet…</p>}
        {status && (
          <div className="stats">
            <div className="card"><span className="muted">XLM</span><span className="stat-value mono">{status.exists ? fmt(status.xlm) : "Cuenta nueva"}</span></div>
            <div className="card"><span className="muted">USDC de prueba</span><span className="stat-value mono">{status.hasUsdcTrustline ? fmt(status.usdc) : "Sin trustline"}</span></div>
            <div className="card"><span className="muted">Verificadora</span><span className="stat-value">{status.verifierFor.length === 3 ? "Sí, 3 hitos" : status.verifierFor.length ? status.verifierFor.map((m) => MILESTONE_LABEL[m]).join(", ") : "No"}</span></div>
          </div>
        )}
        <label>¿Qué rol quieres preparar?{" "}
          <select value={role} onChange={(event) => { setRole(event.target.value as keyof typeof ROLES); setMsg(null); }}>
            {Object.entries(ROLES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
          </select>
        </label>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 12 }}>
          <li>
            <strong>XLM de prueba.</strong> Friendbot crea la cuenta con 10 000 XLM para pagar comisiones.{" "}
            <button className="btn" type="button" disabled={!status || waiting || accountExists} onClick={fund}>
              {accountExists ? "Cuenta fondeada" : busy === "fund" ? "Fondeando…" : "Pedir XLM"}
            </button>
          </li>
          {role === "cooperativa" && <li>
            <strong>Habilita la recepción de USDC.</strong> La firma añade la línea de confianza de Circle en Testnet.{" "}
            <button className="btn" type="button" disabled={!accountExists || waiting || status?.hasUsdcTrustline} onClick={() => prepareUsdc("trustline")}>
              {status?.hasUsdcTrustline ? "Recepción habilitada" : busy === "trustline" ? "Esperando tu firma…" : "Habilitar recepción de USDC"}
            </button>
          </li>}
          {role === "importador" && <li>
            <strong>Consigue saldo de prueba.</strong> Necesitas {TESTNET_ESCROW_AMOUNT} USDC de Testnet. Esta firma abre la línea de confianza si falta y cambia XLM de prueba por 200 USDC.{" "}
            <button className="btn" type="button" disabled={!accountExists || waiting || buyerReady} onClick={() => prepareUsdc("usdc")}>
              {buyerReady ? "Saldo suficiente" : busy === "usdc" ? "Esperando tu firma…" : "Obtener 200 USDC de prueba"}
            </button>
          </li>}
          {role === "verificador" && <li>
            <strong>Registra la cuenta en LotPassport.</strong> El permiso de prueba permite firmar acopio, embarque y llegada.{" "}
            <button className="btn btn-ghost" type="button" disabled={!accountExists || waiting || verifierReady} onClick={verifier}>
              {verifierReady ? "Permisos confirmados" : busy === "verifier" ? "Registrando…" : "Registrar verificador de prueba"}
            </button>
          </li>}
        </ol>
        {msg && <p className={msg.kind === "error" ? "error" : "muted"} role={msg.kind === "error" ? "alert" : "status"} style={{ margin: 0 }}>{msg.text}</p>}
        {address && !status && !waiting && <div><button className="btn btn-ghost" type="button" onClick={refresh}>Volver a consultar la cuenta</button></div>}
        {roleReady && <p><strong>Cuenta preparada.</strong> {ROLES[role].next} <Link href={ROLES[role].href}>Continuar como {role}</Link></p>}
      </section>

      <OperationPanel />
      <section className="card" aria-labelledby="recorrido">
        <h2 id="recorrido">Recorrido del lote {lot.id}</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          <li><strong>Cooperativa</strong> (cuenta A): verifica las parcelas con Whisp y ancla el pasaporte. Firmas con tu wallet. <Link href="/cooperativa">Ir a cooperativa</Link></li>
          <li><strong>Importador</strong> (cuenta B, con USDC): crea y fondea el escrow de {TESTNET_ESCROW_AMOUNT} USDC. <Link href="/importador">Ir a importador</Link></li>
          <li><strong>Verificador</strong> (cuenta registrada): firma acopio, embarque y llegada, en orden. <Link href="/verificador">Ir a verificador</Link></li>
          <li><strong>Importador</strong>: libera cada hito. El servidor comprueba en LotPassport que el hito está firmado; si no, no paga.</li>
          <li><strong>Público</strong>: comparte el pasaporte leído de la cadena. <Link href={`/lote/${lot.id}`}>Ver pasaporte público</Link></li>
        </ol>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Las parcelas y productores son datos de ejemplo. Las transacciones son reales en Stellar Testnet y se pueden ver en stellar.expert.
        </p>
      </section>
    </main>
  );
}
