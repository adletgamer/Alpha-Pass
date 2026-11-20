// Tipos del dominio de Alpha Pass.

export type Milestone = "acopio" | "embarque" | "llegada";
export const MILESTONES: Milestone[] = ["acopio", "embarque", "llegada"];

export const MILESTONE_LABEL: Record<Milestone, string> = {
  acopio: "Acopio",
  embarque: "Embarque",
  llegada: "Llegada",
};

/** Porcentaje del escrow que libera cada hito (suma 100). */
export const MILESTONE_SHARE: Record<Milestone, number> = {
  acopio: 30,
  embarque: 50,
  llegada: 20,
};

export type AssetCode = "USDC" | "EURC";

export type DeforestationRisk = "sin_riesgo" | "alerta" | "pendiente";

export interface Parcel {
  id: string;
  name: string;
  producer: string;
  hectares: number;
  bags: number;
  /** Polígono GeoJSON (se guarda fuera de la cadena). */
  geometry: GeoJSONPolygon;
  risk: DeforestationRisk;
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Attestation {
  milestone: Milestone;
  issuer: string;
  evidenceHash: string;
  timestamp: string;
}

export interface EscrowState {
  /** Id del contrato de escrow (Trustless Work) o "demo-escrow-…" en modo demo. */
  contractId: string;
  asset: AssetCode;
  amount: number;
  funded: boolean;
  pendingFund?: { hash: string; expires: number };
  released: Record<Milestone, boolean>;
}

export interface Lot {
  id: string;
  cooperative: string;
  buyer: string;
  product: string;
  parcels: Parcel[];
  passportRoot?: string;
  attestations: Attestation[];
  escrow?: EscrowState;
  premiumDistributed: boolean;
}
