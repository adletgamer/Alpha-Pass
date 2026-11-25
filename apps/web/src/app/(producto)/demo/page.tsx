"use client";

// Demo guiada en Stellar Testnet con una sola wallet.
// Eliges un rol y firmas solo lo que le toca a ese rol. Las demás partes de la
// operación las firma el servidor con cuentas de prueba de Alpha Pass.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MODE } from "@/lib/adapters";
import { MILESTONE_LABEL, MILESTONES, type Milestone } from "@/lib/domain";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import { milestoneAmount } from "@/lib/release-gate";
import { useTestnetWallet } from "@/components/TestnetWallet";
import { ProductHero } from "@/components/ProductDisplay";
import styles from "./demo.module.css";

type Role = "cooperativa" | "importador" | "verificador";
type Risks = Record<string, "sin_riesgo" | "alerta">;
type Actor = Role | "alpha" | "acta";

const ROLE_LABEL: Record<Role, string> = { cooperativa: "Cooperativa", importador: "Importador", verificador: "Verificador" };
const ROLE_PITCH: Record<Role, string> = {
  cooperativa: "Anclas el pasaporte del lote y cobras los tres hitos en tu wallet.",
  importador: "Fondeas el escrow con USDC de prueba y ves cómo se libera contra cada prueba.",
  verificador: "Firmas acopio, embarque y llegada; sin tu firma, el dinero no se mueve.",
};
const ACTOR_LABEL: Record<Actor, string> = {
  cooperativa: "Cooperativa de la casa", importador: "Importador de la casa", verificador: "Verificador de la casa",
  alpha: "Alpha Pass (servidor)", acta: "Emisora ACTA de Alpha Pass",
};

interface DemoState {
  lotId?: string;
  risks?: Risks;
  source?: string;
  contractId?: string;
  done: Record<string, { hash?: string; note?: string; skipped?: boolean; rejected?: boolean }>;
}

interface Step {
  key: string;
  label: string;
  actor: Actor;
  optional?: boolean;
}

const STEPS: Step[] = [
  { key: "start", label: "Evaluar las 5 parcelas con Whisp (FAO)", actor: "alpha" },
  { key: "credential", label: "Emitir la credencial W3C del lote en ACTA", actor: "acta", optional: true },
  { key: "anchor", label: "Anclar la raíz del pasaporte en LotPassport", actor: "cooperativa" },
  { key: "escrow-deploy", label: `Crear el escrow de ${TESTNET_ESCROW_AMOUNT} USDC en Trustless Work`, actor: "importador" },
  { key: "escrow-fund", label: `Depositar ${TESTNET_ESCROW_AMOUNT} USDC de prueba en el escrow`, actor: "importador" },
  { key: "gate", label: "Intentar liberar el acopio sin prueba", actor: "alpha" },
  ...MILESTONES.flatMap((m): Step[] => [
    { key: `attest-${m}`, label: `Firmar el hito de ${MILESTONE_LABEL[m].toLowerCase()}`, actor: "verificador" },
    { key: `release-${m}`, label: `Liberar ${milestoneAmount(TESTNET_ESCROW_AMOUNT, m)} USDC de ${MILESTONE_LABEL[m].toLowerCase()}`, actor: "alpha" },
  ]),
];

const EXPLORER = "https://stellar.expert/explorer/testnet";
const storageKey = (role: Role, address: string) => `alpha-pass-demo-${role}-${address}`;

async function callDemo<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.message ?? `La demo respondió ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

type StepResult = { signer: "user"; unsignedXdr: string; kind: string } | { signer: "house"; hash?: string; contractId?: string; [k: string]: unknown };

export default function DemoPage() {
  const { address, connect, connecting, error: walletError } = useTestnetWallet();
  const [role, setRole] = useState<Role>("cooperativa");
  const [state, setState] = useState<DemoState>({ done: {} });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState<{ house: Record<Role, string | null>; acta: boolean; approver: string | null } | null>(null);

  useEffect(() => {
    callDemo<typeof status>({ action: "status" }).then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!address) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(role, address)) ?? "null") as DemoState | null;
      setState(saved?.done ? saved : { done: {} });
    } catch {
      setState({ done: {} });
    }
    setReady(false);
    setMsg(null);
  }, [address, role]);

  const save = useCallback((next: DemoState) => {
    setState(next);
    if (address) localStorage.setItem(storageKey(role, address), JSON.stringify(next));
  }, [address, role]);

  const nextIndex = STEPS.findIndex((s) => !state.done[s.key]);
  const finished = nextIndex === -1;
  const started = Boolean(state.lotId);

  /** Firma con la wallet conectada y envía. */
  async function signAndSubmit(result: Extract<StepResult, { signer: "user" }>) {
    const { signXdr } = await import("@/lib/wallet");
    const signedXdr = await signXdr(result.unsignedXdr, { expectedAddress: address! });
    return callDemo<{ hash: string; contractId?: string }>({ action: "submit", kind: result.kind, signedXdr });
  }

  async function prepare() {
    if (!address) return;
    setBusy("prepare");
    setMsg(null);
    try {
      const result = await callDemo<StepResult & { note?: string }>({ action: "prepare", role, address });
      if (result.signer === "user") {
        setMsg({ kind: "ok", text: `${result.note ?? "Firma la preparación de tu cuenta."} Revisa tu wallet.` });
        await signAndSubmit(result);
      }
      setReady(true);
      setMsg({ kind: "ok", text: "Tu wallet está lista. Ya puedes recorrer la operación." });
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  /** Ejecuta un paso. Devuelve el nuevo estado. */
  async function runStep(step: Step, current: DemoState): Promise<DemoState> {
    const base = { role, address };
    const milestone = step.key.split("-")[1] as Milestone;
    let result: StepResult;
    switch (step.key) {
      case "start": {
        const r = await callDemo<{ lotId: string; risks: Risks; source: string }>({ action: "start", ...base });
        const alerts = Object.values(r.risks).filter((v) => v === "alerta").length;
        const note = `${5 - alerts} parcelas aptas, ${alerts} con alerta${r.source === "grabada" ? " (Whisp no respondió: respuesta grabada)" : ""}.`;
        return { ...current, lotId: r.lotId, risks: r.risks, source: r.source, done: { ...current.done, start: { note } } };
      }
      case "credential":
        result = await callDemo({ action: "credential", ...base, lotId: current.lotId, risks: current.risks });
        break;
      case "anchor":
        result = await callDemo({ action: "anchor", ...base, lotId: current.lotId, risks: current.risks });
        break;
      case "escrow-deploy":
        result = await callDemo({ action: "escrow-deploy", ...base, lotId: current.lotId });
        break;
      case "escrow-fund":
        result = await callDemo({ action: "escrow-fund", ...base, lotId: current.lotId, contractId: current.contractId });
        break;
      case "gate":
        try {
          await callDemo({ action: "release", ...base, lotId: current.lotId, contractId: current.contractId, milestone: "acopio" });
          throw new Error("La liberación sin prueba no fue rechazada.");
        } catch (err) {
          if ((err as { status?: number }).status !== 409) throw err;
          return { ...current, done: { ...current.done, gate: { rejected: true, note: `Rechazado con 409: ${(err as Error).message}` } } };
        }
      default:
        result = step.key.startsWith("attest")
          ? await callDemo({ action: "attest", ...base, lotId: current.lotId, milestone })
          : await callDemo({ action: "release", ...base, lotId: current.lotId, contractId: current.contractId, milestone });
    }
    let hash: string | undefined;
    let contractId = current.contractId;
    if (result.signer === "user") {
      setMsg({ kind: "ok", text: "Firma la transacción en tu wallet." });
      const sent = await signAndSubmit(result);
      hash = sent.hash;
      contractId = sent.contractId ?? contractId;
    } else {
      hash = result.hash;
      contractId = (result.contractId as string | undefined) ?? contractId;
    }
    const note = step.key === "credential" ? `Credencial ${String((result as { vcId?: string }).vcId ?? "")} · estado ${String((result as { status?: string }).status ?? "emitida")}` : undefined;
    return { ...current, contractId, done: { ...current.done, [step.key]: { hash, note } } };
  }

  /** Corre el paso actual y sigue solo con los pasos que no firma el usuario. */
  async function advance() {
    let current = state;
    setMsg(null);
    for (let i = STEPS.findIndex((s) => !current.done[s.key]); i !== -1 && i < STEPS.length; i++) {
      const step = STEPS[i];
      if (i !== nextIndex && step.actor === role) break;
      if (step.key === "credential" && status && !status.acta) break;
      setBusy(step.key);
      try {
        current = await runStep(step, current);
        save(current);
      } catch (err) {
        setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        setBusy(null);
        return;
      }
    }
    setBusy(null);
    setMsg(null);
  }

  function skipCredential() {
    save({ ...state, done: { ...state.done, credential: { skipped: true, note: "Omitido: la emisora ACTA no está configurada en este entorno." } } });
  }

  function reset() {
    save({ done: {} });
    setMsg(null);
  }

  const cast = useMemo(() => (["cooperativa", "importador", "verificador"] as Role[]).map((r) => ({
    role: r, address: r === role ? address : status?.house[r] ?? null, you: r === role,
  })), [role, address, status]);

  if (MODE !== "testnet") {
    return (
      <main className="container product-shell">
        <ProductHero label="Demo guiada" title="Testnet no disponible" description="Este despliegue necesita la configuración de Stellar Testnet." />
      </main>
    );
  }

  const current = finished ? null : STEPS[nextIndex];
  const credentialBlocked = current?.key === "credential" && status && !status.acta;

  return (
    <main className="container product-shell">
      <ProductHero
        label="Demo guiada · Stellar Testnet"
        title="Una operación completa con una sola wallet"
        description="Elige tu rol y firma solo lo que le toca. Alpha Pass firma las demás partes con cuentas de prueba propias, en la misma red y con las mismas reglas."
      />

      <fieldset className="testnet-role-picker">
        <legend>Tu rol</legend>
        {(Object.keys(ROLE_LABEL) as Role[]).map((value) => (
          <label key={value} className="testnet-role-choice">
            <input type="radio" name="demo-role" checked={role === value} disabled={busy !== null || started} onChange={() => setRole(value)} />
            <span><strong>{ROLE_LABEL[value]}</strong><small>{ROLE_PITCH[value]}</small></span>
          </label>
        ))}
      </fieldset>

      <div className={styles.layout}>
        <section className="card" aria-labelledby="demo-operacion">
          <div className="product-card-heading">
            <h2 id="demo-operacion">{state.lotId ? `Lote ${state.lotId}` : "Operación"}</h2>
            {finished ? <span className="pill pill-ok">Operación completa</span> : started ? <span className="pill pill-wait">En curso</span> : null}
          </div>

          {!address ? (
            <>
              <p className="product-subtitle">Conecta Freighter, xBull, Albedo u otra wallet de Stellar en Testnet. Solo necesitas una.</p>
              <div><button className="btn" type="button" disabled={connecting} onClick={() => void connect()}>{connecting ? "Conectando…" : "Conectar wallet"}</button></div>
              {walletError && <p className="error" role="alert">{walletError}</p>}
            </>
          ) : !ready && !started ? (
            <>
              <p className="product-subtitle">
                Alpha Pass pide XLM a Friendbot para tu cuenta
                {role === "cooperativa" ? " y te pide una firma para habilitar la recepción de USDC." :
                  role === "importador" ? " y te pide una firma para cambiar XLM de prueba por 200 USDC de prueba." :
                    " y la registra como verificadora de los tres hitos. No necesitas firmar nada más."}
              </p>
              <div><button className="btn" type="button" disabled={busy !== null} onClick={prepare}>{busy === "prepare" ? "Preparando…" : "Preparar mi wallet"}</button></div>
            </>
          ) : null}

          <ol className={styles.steps}>
            {STEPS.map((step, i) => {
              const done = state.done[step.key];
              const mine = step.actor === role;
              const dataState = done ? (done.rejected ? "rejected" : "done") : i === nextIndex ? "current" : "pending";
              return (
                <li key={step.key} className={styles.step} data-state={dataState}>
                  <span className={styles.index}>{done ? (done.rejected ? "✕" : "✓") : String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.body}>
                    <span className={styles.label}>{step.label}</span>
                    <span className={styles.who}>Firma: <strong>{mine ? "tú" : ACTOR_LABEL[step.actor]}</strong></span>
                    {done?.note && <span className={styles.note}>{done.note}</span>}
                    {(done?.hash || (step.key === "escrow-deploy" && done && state.contractId)) && (
                      <span className={styles.links}>
                        {done.hash && <a href={`${EXPLORER}/tx/${done.hash}`} target="_blank" rel="noopener">tx {done.hash.slice(0, 10)}…</a>}
                        {step.key === "escrow-deploy" && state.contractId && <a href={`${EXPLORER}/contract/${state.contractId}`} target="_blank" rel="noopener">escrow {state.contractId.slice(0, 8)}…</a>}
                      </span>
                    )}
                  </div>
                  <span className={`${styles.badge} ${mine ? styles.badgeUser : ""}`}>{mine ? "Tu firma" : "Automático"}</span>
                </li>
              );
            })}
          </ol>

          {msg && <p className={msg.kind === "error" ? "error" : "product-subtitle"} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}

          {address && (ready || started) && (
            <div className="product-inline-actions">
              {current && (
                <button className="btn" type="button" disabled={busy !== null || Boolean(credentialBlocked)} onClick={advance}>
                  {busy ? "Procesando en Stellar Testnet…" : current.actor === role ? `Firmar: ${current.label.toLowerCase()}` : `Continuar: ${current.label.toLowerCase()}`}
                </button>
              )}
              {current?.optional && credentialBlocked && (
                <button className="btn btn-ghost" type="button" disabled={busy !== null} onClick={skipCredential}>Omitir este paso</button>
              )}
              {state.lotId && <Link className="btn btn-ghost" href={`/lote/${state.lotId}`}>Ver pasaporte público</Link>}
              {(finished || started) && <button className="btn btn-ghost" type="button" disabled={busy !== null} onClick={reset}>Nueva demo</button>}
            </div>
          )}
          {credentialBlocked && <p className="product-subtitle">La emisora ACTA no está configurada en este entorno. Puedes omitir la credencial y seguir con el resto del flujo.</p>}
          {finished && (
            <p className="product-subtitle">
              Los tres hitos se liberaron solo después de cada atestación en LotPassport.
              {role === "cooperativa" ? " Revisa tu wallet: recibiste el pago menos la comisión del protocolo." : ""}
            </p>
          )}
        </section>

        <aside className="card" aria-labelledby="demo-reparto">
          <h2 id="demo-reparto">Quién firma</h2>
          <ul className={styles.cast}>
            {cast.map((c) => (
              <li key={c.role}>
                <strong>{ROLE_LABEL[c.role]} {c.you && <span className={styles.you}>· tú</span>}</strong>
                {c.address ? <a href={`${EXPLORER}/account/${c.address}`} target="_blank" rel="noopener"><code className="mono">{c.address}</code></a>
                  : <span className="muted">{c.you ? "Conecta tu wallet" : "Cuenta de la casa no configurada"}</span>}
              </li>
            ))}
            <li>
              <strong>Alpha Pass · aprobadora</strong>
              <span className="muted">Aprueba y libera cada hito solo si LotPassport.is_attested devuelve true.</span>
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
