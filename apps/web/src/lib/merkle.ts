// Raíz Merkle SHA-256 de las credenciales del pasaporte.
// Cada hoja es el hash del JSON canónico de una credencial; solo la raíz va a
// LotPassport en Stellar. Las credenciales completas quedan fuera de la cadena.
import type { Lot, Parcel } from "./domain";

export function passportRoot(lot: Lot, parcels: Parcel[]) {
  return merkleRoot(passportClaims(lot, parcels));
}

export function passportClaims(lot: Lot, parcels: Parcel[]) {
  return [
    { kind: "organizacion", cooperative: lot.cooperative },
    ...parcels.map((p) => ({ kind: "parcela", id: p.id, producer: p.producer, geometry: p.geometry })),
    ...parcels.map((p) => ({ kind: "deforestacion", id: p.id, result: p.risk, source: "whisp" })),
    { kind: "composicion", lot: lot.id, parcels: parcels.map((p) => [p.id, p.bags]) },
  ];
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** JSON con claves ordenadas, para que el mismo objeto dé siempre el mismo hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function merkleRoot(leaves: unknown[]): Promise<string> {
  if (leaves.length === 0) throw new Error("Se necesita al menos una credencial");
  let level = await Promise.all(leaves.map((l) => sha256Hex(canonicalJson(l))));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left; // nodo impar: se duplica
      next.push(await sha256Hex(fromHex(left + right)));
    }
    level = next;
  }
  return level[0];
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
