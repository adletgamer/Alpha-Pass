"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { AssetCode, Lot, Milestone } from "./domain";
import { MILESTONES } from "./domain";
import { canRelease, GATE_MESSAGE, splitPremium } from "./release-gate";
import { initialLot, DEMO_PREMIUM } from "./sample-data";
import { merkleRoot, sha256Hex } from "./merkle";
import { providers } from "./adapters";

type Action =
  | { type: "reset" }
  | { type: "load"; lot: Lot }
  | { type: "risk"; risks: Record<string, "sin_riesgo" | "alerta"> }
  | { type: "anchor"; root: string }
  | { type: "fund"; asset: AssetCode; amount: number; contractId: string }
  | { type: "attest"; milestone: Milestone; issuer: string; evidenceHash: string }
  | { type: "release"; milestone: Milestone }
  | { type: "premium" };

function reducer(lot: Lot, a: Action): Lot {
  switch (a.type) {
    case "reset":
      return initialLot();
    case "load":
      return a.lot;
    case "risk":
      return { ...lot, parcels: lot.parcels.map((p) => ({ ...p, risk: a.risks[p.id] ?? p.risk })) };
    case "anchor":
      return { ...lot, passportRoot: a.root };
    case "fund":
      return {
        ...lot,
        escrow: {
          contractId: a.contractId,
          asset: a.asset,
          amount: a.amount,
          funded: true,
          released: { acopio: false, embarque: false, llegada: false },
        },
      };
    case "attest":
      return {
        ...lot,
        attestations: [
          ...lot.attestations,
          { milestone: a.milestone, issuer: a.issuer, evidenceHash: a.evidenceHash, timestamp: new Date().toISOString() },
        ],
      };
    case "release":
      if (!lot.escrow) return lot;
      return { ...lot, escrow: { ...lot.escrow, released: { ...lot.escrow.released, [a.milestone]: true } } };
    case "premium":
      return { ...lot, premiumDistributed: true };
  }
}

export function eligibleParcels(lot: Lot) {
  return lot.parcels.filter((p) => p.risk === "sin_riesgo");
}

interface Ctx {
  lot: Lot;
  busy: boolean;
  log: string[];
  verifyParcels(): Promise<void>;
  anchorPassport(): Promise<void>;
  fundEscrow(asset: AssetCode, amount: number): Promise<void>;
  attest(milestone: Milestone, issuer: string, evidence: string): Promise<string | null>;
  release(milestone: Milestone): Promise<string | null>;
  distributePremium(): number[];
  reset(): void;
}

const LotContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "alpha-pass-demo-lot";

export function LotProvider({ children }: { children: React.ReactNode }) {
  const [lot, dispatch] = useReducer(reducer, undefined, initialLot);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = useCallback((m: string) => setLog((l) => [`${new Date().toLocaleTimeString("es-PE")} · ${m}`, ...l].slice(0, 30)), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: "load", lot: JSON.parse(saved) });
    } catch {
      /* estado nuevo si no hay almacenamiento */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lot));
    } catch {
      /* sin persistencia */
    }
  }, [lot]);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog((l) => [`${new Date().toLocaleTimeString("es-PE")} · Error: ${msg}`, ...l].slice(0, 30));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<Ctx>(() => ({
    lot,
    busy,
    log,
    verifyParcels: () => run(async () => {
      const risks = await providers.deforestation.assess(lot.parcels);
      dispatch({ type: "risk", risks });
      const alerts = Object.values(risks).filter((r) => r === "alerta").length;
      note(`Verificación satelital: ${lot.parcels.length - alerts} sin riesgo, ${alerts} con alerta`);
    }),
    anchorPassport: () => run(async () => {
      const parcels = eligibleParcels(lot);
      const credentials = [
        { kind: "organizacion", cooperative: lot.cooperative },
        ...parcels.map((p) => ({ kind: "parcela", id: p.id, producer: p.producer, geometry: p.geometry })),
        ...parcels.map((p) => ({ kind: "deforestacion", id: p.id, result: p.risk, source: "whisp" })),
        { kind: "composicion", lot: lot.id, parcels: parcels.map((p) => [p.id, p.bags]) },
      ];
      const root = await merkleRoot(credentials);
      const res = await providers.passport.anchor(lot, root, parcels);
      dispatch({ type: "anchor", root });
      note(`Pasaporte anclado · raíz ${root.slice(0, 8)}… · ${res.note}`);
    }),
    fundEscrow: (asset, amount) => run(async () => {
      const { contractId } = await providers.escrow.createAndFund({ lotId: lot.id, asset, amount });
      dispatch({ type: "fund", asset, amount, contractId });
      note(`Escrow fondeado con ${amount.toLocaleString("es-PE")} ${asset}`);
    }),
    attest: (milestone, issuer, evidence) => run(async () => {
      const idx = MILESTONES.indexOf(milestone);
      if (lot.attestations.some((a) => a.milestone === milestone)) return "Este hito ya tiene su credencial.";
      if (idx > 0 && !lot.attestations.some((a) => a.milestone === MILESTONES[idx - 1])) {
        return "El hito anterior todavía no está atestado.";
      }
      const evidenceHash = await sha256Hex(evidence);
      try {
        await providers.passport.attest(lot.id, milestone, evidenceHash);
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
      dispatch({ type: "attest", milestone, issuer, evidenceHash });
      note(`Credencial de ${milestone} firmada por ${issuer}`);
      return null;
    }),
    release: (milestone) => run(async () => {
      const gate = canRelease(lot, milestone);
      if (!gate.ok) {
        note(`Liberación de ${milestone} rechazada: ${GATE_MESSAGE[gate.reason]}`);
        return GATE_MESSAGE[gate.reason];
      }
      try {
        await providers.escrow.release({ contractId: lot.escrow!.contractId, lotId: lot.id, milestone });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        note(`Liberación de ${milestone} rechazada: ${msg}`);
        return msg;
      }
      dispatch({ type: "release", milestone });
      note(`Hito ${milestone} liberado`);
      return null;
    }),
    distributePremium: () => {
      const parcels = eligibleParcels(lot);
      const shares = splitPremium(DEMO_PREMIUM, parcels.map((p) => p.bags));
      dispatch({ type: "premium" });
      note(`Premio de ${DEMO_PREMIUM} ${lot.escrow?.asset ?? ""} repartido a ${parcels.length} productores`);
      return shares;
    },
    reset: () => {
      dispatch({ type: "reset" });
      setLog([]);
    },
  }), [lot, busy, log, run, note]);

  return <LotContext.Provider value={value}>{children}</LotContext.Provider>;
}

export function useLot() {
  const ctx = useContext(LotContext);
  if (!ctx) throw new Error("useLot debe usarse dentro de LotProvider");
  return ctx;
}
