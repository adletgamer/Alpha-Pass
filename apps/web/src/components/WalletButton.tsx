"use client";

import { MODE } from "@/lib/adapters";
import { useTestnetWallet } from "./TestnetWallet";

export function WalletButton() {
  const { address, connecting, error, connect } = useTestnetWallet();
  if (MODE !== "testnet") return null;

  return (
    <span className="product-inline-actions">
      <button type="button" className={address ? "btn btn-ghost" : "btn"} onClick={connect} disabled={connecting} aria-label={address ? "Cambiar wallet conectada" : undefined}>
        {address ? <span className="mono">{address.slice(0, 4)}…{address.slice(-4)}</span> : "Conectar wallet"}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}
