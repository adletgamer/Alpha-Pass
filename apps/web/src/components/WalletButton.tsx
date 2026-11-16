"use client";

import { useState } from "react";
import { MODE } from "@/lib/adapters";

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (MODE !== "testnet") return null;

  async function connect() {
    setError(null);
    try {
      const { connectWallet } = await import("@/lib/wallet");
      setAddress(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar la wallet");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" className={address ? "btn btn-ghost" : "btn"} onClick={connect}>
        {address ? <span className="mono">{address.slice(0, 4)}…{address.slice(-4)}</span> : "Conectar wallet"}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}
