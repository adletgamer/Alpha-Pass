"use client";

import { useState } from "react";
import { useLot } from "@/lib/store";
import { milestoneReceipts, OPERATION_ROLES } from "@/lib/operation";
import { useTestnetWallet } from "./TestnetWallet";

export function OperationPanel() {
  const { mode, lot, busy, operation } = useLot();
  const wallet = useTestnetWallet();
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  if (mode !== "testnet") return null;

  async function perform(fn: () => Promise<unknown>, result?: string) {
    setWorking(true);
    setMessage(null);
    try {
      await fn();
      setMessage(result ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      setWorking(false);
    }
  }

  const view = operation.view;
  const receipts = view ? milestoneReceipts(view.progress) : [];
  const canCreate = wallet.address && !lot.passportRoot && !lot.escrow;
  const copy = (path: string) => perform(
    () => navigator.clipboard.writeText(new URL(path, window.location.origin).href),
    "Enlace copiado. Compártelo solo con la persona que cumple ese rol.",
  );

  return (
    <section className="card" aria-labelledby="operation-title">
      <div className="product-card-heading">
        <h2 id="operation-title">Operación compartida</h2>
        {view && <span className="pill pill-ok">Acceso de {view.role}</span>}
      </div>
      {view ? (
        <>
          <div className="product-address"><strong>Lote</strong><code className="mono">{lot.id}</code></div>
          <p className="product-subtitle">Cada enlace permite entrar al lote y operar con los permisos de su rol.</p>
          <div className="product-inline-actions">
            {OPERATION_ROLES.map((role) => {
              const path = operation.invite(role);
              return path && <button key={role} type="button" className="btn btn-ghost" disabled={working} onClick={() => copy(path)}>Copiar enlace de {role}</button>;
            })}
          </div>
          {receipts.length > 0 && (
            <details>
              <summary>Referencias de transacciones</summary>
              <ul>{receipts.map(({ label, hash }) => <li key={label}><a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer">{label} · {hash?.slice(0, 10)}…</a></li>)}</ul>
            </details>
          )}
        </>
      ) : (
        <p style={{ margin: 0 }}>{operation.active
          ? "Consultando el lote compartido."
          : "La cooperativa puede abrir un lote compartido antes de anclar el pasaporte y enviar enlaces al importador y al verificador."}</p>
      )}
      <div className="product-inline-actions">
        {(!operation.active || (!view && operation.error && canCreate)) && (
          <button type="button" className="btn" disabled={working || busy || !canCreate} onClick={() => perform(operation.create)}>
            Abrir operación compartida
          </button>
        )}
        {operation.active && <>
          <button type="button" disabled={working || busy} className="btn btn-ghost" onClick={() => perform(operation.refresh)}>Actualizar estado</button>
          <button type="button" disabled={working || busy} className="btn btn-ghost" onClick={operation.leave}>Salir del lote compartido</button>
        </>}
      </div>
      {!operation.active && !wallet.address && <p className="muted" style={{ margin: 0 }}>Conecta primero la wallet de la cooperativa.</p>}
      {operation.error && <p className="error" role="alert" style={{ margin: 0 }}>{operation.error}</p>}
      {message && <p role="status" style={{ margin: 0 }}>{message}</p>}
    </section>
  );
}
