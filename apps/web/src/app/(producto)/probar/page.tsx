"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MODE } from "@/lib/adapters";
import { useLot } from "@/lib/store";
import { MILESTONE_LABEL, type Milestone } from "@/lib/domain";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";

interface Status {
  exists: boolean;
  xlm: string;
  hasUsdcTrustline: boolean;
  usdc: string;
  verifierFor: Milestone[];
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/testnet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
  return json as T;
}

const fmt = (v: string) => Number(v).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default function ProbarPage() {
  const { lot } = useLot();
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async (addr: string) => {
    setStatus(await call<Status>({ action: "status", address: addr }));
  }, []);

  async function step(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMsg(null);
    try {
      setMsg({ kind: "ok", text: await fn() });
      if (address) await refresh(address);
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const connect = () =>
    step("connect", async () => {
      const { connectWallet } = await import("@/lib/wallet");
      const addr = await connectWallet();
      setAddress(addr);
      await refresh(addr);
      return `Wallet conectada: ${addr.slice(0, 4)}…${addr.slice(-4)}`;
    });

  const fund = () =>
    step("fund", async () => {
      const r = await call<{ funded: boolean }>({ action: "fund", address });
      return r.funded ? "Listo: friendbot depositó 10 000 XLM de prueba." : "La cuenta ya existía en Testnet.";
    });

  const getUsdc = () =>
    step("usdc", async () => {
      const { signXdr } = await import("@/lib/wallet");
      const { unsignedXdr } = await call<{ unsignedXdr: string }>({ action: "usdc", address });
      const { hash } = await call<{ hash: string }>({ action: "submit", signedXdr: await signXdr(unsignedXdr) });
      return `Listo: 200 USDC de prueba en tu cuenta (tx ${hash.slice(0, 10)}…).`;
    });

  const verifier = () =>
    step("verifier", async () => {
      const r = await call<{ registered: Milestone[] }>({ action: "verifier", address });
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

  const ready = Boolean(status?.exists);
  return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div>
        <div className="muted">Stellar Testnet · sin dinero real</div>
        <h1>Prueba el flujo completo con tu wallet</h1>
        <p style={{ margin: "8px 0 0" }}>
          Funciona con cualquier wallet de Stellar en Testnet (Freighter, xBull, Lobstr, Albedo…). Aquí la dejas lista en tres pasos;
          después recorres el lote como cooperativa, importador y verificador.
        </p>
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
          <button className={address ? "btn btn-ghost" : "btn"} type="button" disabled={busy !== null} onClick={connect}>
            {address ? "Conectar otra cuenta" : "Conectar wallet"}
          </button>
        </div>
        {address && (
          <div className="mono muted" style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>{address}</div>
        )}
        {status && (
          <div className="stats">
            <div className="card"><span className="muted">XLM</span><span className="stat-value mono">{status.exists ? fmt(status.xlm) : "Cuenta nueva"}</span></div>
            <div className="card"><span className="muted">USDC de prueba</span><span className="stat-value mono">{status.hasUsdcTrustline ? fmt(status.usdc) : "Sin trustline"}</span></div>
            <div className="card"><span className="muted">Verificadora</span><span className="stat-value">{status.verifierFor.length === 3 ? "Sí, 3 hitos" : status.verifierFor.length ? status.verifierFor.map((m) => MILESTONE_LABEL[m]).join(", ") : "No"}</span></div>
          </div>
        )}
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 12 }}>
          <li>
            <strong>XLM de prueba.</strong> Friendbot crea la cuenta con 10 000 XLM para pagar comisiones.{" "}
            <button className="btn" type="button" disabled={!address || busy !== null || ready} onClick={fund}>
              {ready ? "Cuenta fondeada" : busy === "fund" ? "Fondeando…" : "Pedir XLM"}
            </button>
          </li>
          <li>
            <strong>USDC de prueba (en las dos cuentas).</strong> Firmas una transacción que abre la trustline de USDC de Circle (Testnet),
            necesaria para cobrar, y compra 200 USDC con tu propio XLM en el DEX de Testnet. El escrow de prueba usa {TESTNET_ESCROW_AMOUNT} USDC.{" "}
            <button className="btn" type="button" disabled={!ready || busy !== null} onClick={getUsdc}>
              {busy === "usdc" ? "Esperando tu firma…" : "Obtener 200 USDC"}
            </button>
          </li>
          <li>
            <strong>Rol de verificador (opcional).</strong> Alpha Pass registra tu wallet en LotPassport para que puedas firmar los hitos de acopio,
            embarque y llegada. En producción este rol se da solo a almacenes, agentes de carga y laboratorios acreditados.{" "}
            <button className="btn btn-ghost" type="button" disabled={!ready || busy !== null || status?.verifierFor.length === 3} onClick={verifier}>
              {busy === "verifier" ? "Registrando… (~20 s)" : "Hacerme verificador de prueba"}
            </button>
          </li>
        </ol>
        {msg && <p className={msg.kind === "error" ? "error" : "muted"} role={msg.kind === "error" ? "alert" : "status"} style={{ margin: 0 }}>{msg.text}</p>}
      </section>

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
