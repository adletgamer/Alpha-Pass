import type { Lot, Parcel } from "./domain";

// Datos de ejemplo para la demo. Productores, lugares y polígonos son ficticios.
function square(lng: number, lat: number, d = 0.006): Parcel["geometry"] {
  return {
    type: "Polygon",
    coordinates: [[
      [lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat],
    ]],
  };
}

export const SAMPLE_PARCELS: Parcel[] = [
  { id: "P-01", name: "Huabal", producer: "Productor A", hectares: 2.4, bags: 14, geometry: square(-78.85, -5.62), risk: "pendiente" },
  { id: "P-02", name: "Huabal", producer: "Productor B", hectares: 1.8, bags: 12, geometry: square(-78.84, -5.61), risk: "pendiente" },
  { id: "P-03", name: "Las Pirias", producer: "Productor C", hectares: 3.1, bags: 19, geometry: square(-78.83, -5.6), risk: "pendiente" },
  { id: "P-04", name: "Las Pirias", producer: "Productor D", hectares: 1.5, bags: 15, geometry: square(-78.82, -5.59), risk: "pendiente" },
  { id: "P-05", name: "Chontalí", producer: "Productor E", hectares: 2.0, bags: 10, geometry: square(-79.1, -5.64), risk: "pendiente" },
];

/** Respuesta grabada del verificador satelital para la demo (P-05 con alerta). */
export const RECORDED_RISK: Record<string, "sin_riesgo" | "alerta"> = {
  "P-01": "sin_riesgo",
  "P-02": "sin_riesgo",
  "P-03": "sin_riesgo",
  "P-04": "sin_riesgo",
  "P-05": "alerta",
};

export function initialLot(): Lot {
  return {
    id: "2026-JAE-014",
    cooperative: "Cooperativa Demo Jaén",
    buyer: "Importador Demo Hamburgo",
    product: "Café verde arábica",
    parcels: SAMPLE_PARCELS.map((p) => ({ ...p })),
    attestations: [],
    premiumDistributed: false,
  };
}

export const DEMO_ESCROW_AMOUNT = 16500;
export const DEMO_PREMIUM = 1200;
