"use client";

import { LotProvider } from "@/lib/store";
import { ActaProvider } from "@/lib/acta-bridge";
import { MODE } from "@/lib/adapters";

export function Providers({ children }: { children: React.ReactNode }) {
  const app = <LotProvider>{children}</LotProvider>;
  return MODE === "testnet" ? <ActaProvider>{app}</ActaProvider> : app;
}
