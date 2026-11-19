"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Milestone } from "@/lib/domain";

type WalletStatus = {
  exists: boolean;
  xlm: string;
  hasUsdcTrustline: boolean;
  usdc: string;
  verifierFor: Milestone[];
};

export async function callTestnet<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/testnet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.message ?? `Error de Stellar Testnet (${response.status}).`);
  return data as T;
}

function useWalletSession() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setStatus(null);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    setReading(true);
    setError(null);
    callTestnet<WalletStatus>({ action: "status", address }, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setStatus(result); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo consultar la cuenta.");
      })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [address, revision]);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const { connectWallet } = await import("@/lib/wallet");
      setAddress(await connectWallet());
      refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo conectar la wallet.");
    } finally {
      setConnecting(false);
    }
  }

  return { address, status, connecting, reading, error, connect, refresh };
}

const TestnetWalletContext = createContext<ReturnType<typeof useWalletSession> | null>(null);

export function TestnetWalletProvider({ children }: { children: React.ReactNode }) {
  const session = useWalletSession();
  return <TestnetWalletContext.Provider value={session}>{children}</TestnetWalletContext.Provider>;
}

export function useTestnetWallet() {
  const session = useContext(TestnetWalletContext);
  if (!session) throw new Error("Falta el proveedor de wallet del producto.");
  return session;
}
