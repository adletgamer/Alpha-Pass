"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { AssetCode, Lot, Milestone } from "./domain";
import { MILESTONES } from "./domain";
import { canRelease, GATE_MESSAGE, splitPremium } from "./release-gate";
import { initialLot, newTestnetLotId, DEMO_PREMIUM } from "./sample-data";
import { passportRoot, sha256Hex } from "./merkle";
import { api, demoProviders, providers as appProviders, MODE, type AlphaMode } from "./adapters";
import { useSharedOperation } from "./operation-client";
import { resumeEscrow } from "./escrow-recovery";
import type { OperationRole, Risks, SharedOperation } from "./operation";

type Action =
  | { type: "reset"; id?: string }
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
      return initialLot(a.id);
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
  mode: AlphaMode;
  preview: boolean;
  lot: Lot;
  busy: boolean;
  log: string[];
  operation: {
    active: boolean;
    view: SharedOperation | null;
    error: string | null;
    invite(role: OperationRole): string | null;
    create(): Promise<void>;
    refresh(): Promise<unknown>;
    leave(): void;
  };
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

interface LotProviderProps {
  children: React.ReactNode;
  /** Estado inicial (vista previa de la home). */
  initial?: Lot;
  /** Vista previa: servicios simulados y sin persistencia. Nunca firma transacciones. */
  preview?: boolean;
}

export function LotProvider({ children, initial, preview = false }: LotProviderProps) {
  const [localLot, dispatch] = useReducer(reducer, undefined, () => initial ?? initialLot());
  const shared = useSharedOperation(!preview && MODE === "testnet");
  const lot = shared.view?.lot ?? localLot;
  const providers = preview ? demoProviders : appProviders;
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = useCallback((m: string) => setLog((l) => [`${new Date().toLocaleTimeString("es-PE")} · ${m}`, ...l].slice(0, 30)), []);

  useEffect(() => {
    if (preview) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) dispatch({ type: "load", lot: JSON.parse(saved) });
      // En Testnet, un lote nuevo necesita un ID que no exista todavía en LotPassport.
      else if (MODE === "testnet") dispatch({ type: "reset", id: newTestnetLotId() });
    } catch {
      /* estado nuevo si no hay almacenamiento */
    }
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localLot));
    } catch {
      /* sin persistencia */
    }
  }, [localLot, preview]);

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

  const value = useMemo<Ctx>(() => {
    function requireRole(role: OperationRole) {
      if (!shared.access) return;
      if (shared.view?.role !== role) throw new Error(`Abre el enlace de ${role} para continuar.`);
    }
    return {
    mode: preview ? "demo" : MODE,
    preview,
    lot,
    busy,
    log,
    operation: {
      active: Boolean(shared.access),
      view: shared.view,
      error: shared.error,
      invite(role) {
        const access = shared.access;
        return access?.invites && shared.view
          ? `/${role}?lote=${encodeURIComponent(access.lotId)}#acceso=${access.invites[role]}`
          : null;
      },
      create: () => run(async () => {
        if (localLot.passportRoot || localLot.escrow) throw new Error("Para compartir el flujo, inicia un lote nuevo antes de anclarlo.");
        const { currentAddress } = await import("./wallet");
        await shared.create(localLot.id, await currentAddress());
        if (localLot.parcels.every((p) => p.risk !== "pendiente")) {
          // La verificación se repite para que la operación compartida tenga sus propios resultados.
          note("Operación creada. Verifica las parcelas dentro del lote compartido.");
        }
      }),
      refresh: shared.refresh,
      leave: shared.leave,
    },
    verifyParcels: () => run(async () => {
      requireRole("cooperativa");
      const risks = shared.access
        ? (await api<{ risks: Risks }>("/api/whisp", { lotId: lot.id }, shared.access.key)).risks
        : await providers.deforestation.assess(lot.parcels);
      if (shared.access) {
        await shared.refresh();
      } else dispatch({ type: "risk", risks });
      const alerts = Object.values(risks).filter((r) => r === "alerta").length;
      note(`Verificación satelital: ${lot.parcels.length - alerts} sin riesgo, ${alerts} con alerta`);
    }),
    anchorPassport: () => run(async () => {
      requireRole("cooperativa");
      const parcels = eligibleParcels(lot);
      const root = await passportRoot(lot, parcels);
      if (shared.view) {
        const current = await shared.refresh();
        if (!current || current.lot.passportRoot) return;
        if (current.pendingAnchor) throw new Error("El anclaje ya se envió. Espera la confirmación en Stellar.");
        const { currentAddress } = await import("./wallet");
        const owner = await currentAddress();
        if (owner !== current.cooperative) throw new Error("Conecta la cuenta de la cooperativa que abrió el lote.");
        if (!current.progress.credential) {
          const { getActaBridge } = await import("./acta-bridge");
          const acta = getActaBridge();
          const recovered = await acta.recoverPassport(owner, lot.id, root).catch(() => null);
          const vc = recovered ? { vcId: recovered, txId: "" } : await acta.issuePassport({
              lotId: lot.id, cooperative: lot.cooperative, passportRoot: root,
              parcels: parcels.map(({ id, bags, risk }) => ({ id, bags, risk })), verifiedWith: "Whisp (FAO)",
            }, owner);
          await shared.checkpoint({ type: "credential", credential: { root, id: vc.vcId, txHash: vc.txId } });
        } else if (current.progress.credential.root !== root) {
          throw new Error("La raíz no coincide con la credencial ACTA guardada.");
        }
        try {
          const { createLotOnChain } = await import("./lot-passport-client");
          await createLotOnChain(lot.id, root, parcels.length, parcels.reduce((sum, p) => sum + p.bags, 0), {
            expectedCooperative: owner,
            beforeSubmit: (hash, expires) => shared.checkpoint({ type: "anchor", hash, expires }),
          });
        } finally {
          await shared.refresh().catch(() => {});
        }
        return;
      }
      const res = await providers.passport.anchor(lot, root, parcels);
      dispatch({ type: "anchor", root });
      note(`Pasaporte anclado · raíz ${root.slice(0, 8)}… · ${res.note}`);
    }),
    fundEscrow: (asset, amount) => run(async () => {
      requireRole("importador");
      if (shared.view && shared.access) {
        const { currentAddress, NETWORK_PASSPHRASE, signXdr } = await import("./wallet");
        const buyer = await currentAddress();
        const current = await shared.refresh();
        if (!current?.lot.passportRoot) throw new Error("La cooperativa todavía no ancló el pasaporte.");
        const { TransactionBuilder } = await import("@stellar/stellar-sdk");
        const access = shared.access.key;
        try {
          await resumeEscrow(current, { buyer, asset, amount }, {
            prepare: (body) => api("/api/escrow", body, access),
            sign: async (unsigned) => {
              const signed = await signXdr(unsigned, { expectedAddress: buyer });
              const transaction = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);
              const hash = Array.from(transaction.hash(), (byte) => byte.toString(16).padStart(2, "0")).join("");
              const expires = "timeBounds" in transaction ? Number(transaction.timeBounds?.maxTime ?? 0) : 0;
              return { signed, hash, expires };
            },
            submit: (signedXdr) => api("/api/escrow", { action: "submit", lotId: lot.id, signedXdr }, access),
            checkpoint: shared.checkpoint,
            refresh: async () => (await shared.refresh())!,
          });
        } finally {
          await shared.refresh().catch(() => {});
        }
        return;
      }
      const { contractId } = await providers.escrow.createAndFund({ lotId: lot.id, asset, amount });
      dispatch({ type: "fund", asset, amount, contractId });
      note(`Escrow fondeado con ${amount.toLocaleString("es-PE")} ${asset}`);
    }),
    attest: (milestone, issuer, evidence) => run(async () => {
      requireRole("verificador");
      const idx = MILESTONES.indexOf(milestone);
      if (lot.attestations.some((a) => a.milestone === milestone)) return "Este hito ya tiene su credencial.";
      if (idx > 0 && !lot.attestations.some((a) => a.milestone === MILESTONES[idx - 1])) {
        return "El hito anterior todavía no está atestado.";
      }
      const evidenceHash = await sha256Hex(evidence);
      try {
        const result = await providers.passport.attest(lot.id, milestone, evidenceHash);
        if (shared.access && result.txHash) {
          await shared.checkpoint({ type: "attested", milestone, hash: result.txHash });
        }
      } catch (err) {
        if (shared.access) await shared.refresh().catch(() => {});
        return err instanceof Error ? err.message : String(err);
      }
      if (shared.access) await shared.refresh();
      else dispatch({ type: "attest", milestone, issuer, evidenceHash });
      note(`Credencial de ${milestone} firmada por ${issuer}`);
      return null;
    }),
    release: (milestone) => run(async () => {
      requireRole("importador");
      const gate = canRelease(lot, milestone);
      if (!gate.ok) {
        note(`Liberación de ${milestone} rechazada: ${GATE_MESSAGE[gate.reason]}`);
        return GATE_MESSAGE[gate.reason];
      }
      try {
        if (shared.view?.progress.escrow) {
          const { currentAddress } = await import("./wallet");
          if (await currentAddress() !== shared.view.progress.escrow.buyer) {
            throw new Error("Conecta la cuenta del importador que fondeó el escrow.");
          }
        }
        await providers.escrow.release({ contractId: lot.escrow!.contractId, lotId: lot.id, milestone, access: shared.access?.key });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        note(`Liberación de ${milestone} rechazada: ${msg}`);
        return msg;
      }
      if (shared.access) await shared.refresh();
      else dispatch({ type: "release", milestone });
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
      if (shared.access) return;
      dispatch(initial ? { type: "load", lot: initial } : { type: "reset", id: !preview && MODE === "testnet" ? newTestnetLotId() : undefined });
      setLog([]);
    },
    };
  }, [lot, localLot, busy, log, run, note, providers, initial, preview, shared]);

  return <LotContext.Provider value={value}>{children}</LotContext.Provider>;
}

export function useLot() {
  const ctx = useContext(LotContext);
  if (!ctx) throw new Error("useLot debe usarse dentro de LotProvider");
  return ctx;
}
