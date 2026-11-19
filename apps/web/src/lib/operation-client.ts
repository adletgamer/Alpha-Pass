"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { OPERATION_ROLES, type OperationRole, type Checkpoint, type SharedOperation } from "./operation";

type Access = { lotId: string; key: string; invites?: Record<OperationRole, string> };
const storageKey = "alpha-pass-shared-access";

export async function operationRequest<T>(body: object, key: string): Promise<T> {
  const res = await fetch("/api/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-operation-access": key },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload) throw new Error(payload?.message ?? "No se pudo consultar la operación compartida.");
  return payload as T;
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join("");
}

export function useSharedOperation(enabled: boolean) {
  const path = usePathname();
  const active = useRef<Access | null>(null);
  const generation = useRef(0);
  const reading = useRef(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [view, setView] = useState<SharedOperation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activate = useCallback((next: Access | null) => {
    generation.current++;
    active.current = next;
    setAccess(next);
    setView(null);
    setError(null);
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
    } catch { /* la sesión sigue activa en memoria */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    const lotId = url.searchParams.get("lote");
    const key = new URLSearchParams(url.hash.slice(1)).get("acceso");
    if (lotId && key) {
      url.hash = "";
      window.history.replaceState(window.history.state, "", url);
      activate({ lotId, key });
      return;
    }
    if (!active.current) {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) activate(JSON.parse(saved));
      } catch { /* acceso previo inválido */ }
    }
  }, [enabled, path, activate]);

  const refresh = useCallback(async () => {
    const entry = active.current;
    if (!enabled || !entry) return null;
    const order = ++generation.current;
    reading.current = true;
    try {
      const result = await operationRequest<SharedOperation>({ action: "read", lotId: entry.lotId }, entry.key);
      if (order === generation.current) {
        setView(result);
        setError(null);
      }
      return result;
    } catch (failure) {
      if (order === generation.current) setError(failure instanceof Error ? failure.message : "No se pudo actualizar el lote.");
      throw failure;
    } finally {
      if (order === generation.current) reading.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!access || !enabled) return;
    const update = () => { if (!reading.current && !document.hidden) void refresh().catch(() => {}); };
    void refresh().catch(() => {});
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 20000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [access, enabled, refresh]);

  async function create(lotId: string, cooperative: string) {
    const invites = Object.fromEntries(OPERATION_ROLES.map((role) => [role, token()])) as NonNullable<Access["invites"]>;
    // Conserva los códigos incluso si se pierde la respuesta de creación.
    const next = { lotId, key: invites.cooperativa, invites };
    const previous = active.current;
    const pending = previous?.lotId === lotId && previous.invites ? previous : next;
    if (pending !== previous) activate(pending);
    const result = await operationRequest<SharedOperation>({ action: "create", lotId, cooperative, keys: pending.invites }, pending.key);
    if (active.current === pending) {
      generation.current++;
      reading.current = false;
      setError(null);
      setView(result);
    }
    return result;
  }

  async function checkpoint(step: Checkpoint) {
    if (!access) throw new Error("Hace falta un enlace de operación.");
    await operationRequest({ action: "checkpoint", lotId: access.lotId, checkpoint: step }, access.key);
  }

  return { access, view, error, create, refresh, checkpoint, leave: () => activate(null) };
}
