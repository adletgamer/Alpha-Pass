import "server-only";
// Emisión ACTA de punta a punta desde el servidor.
//
// ACTA solo acepta como emisor la wallet asociada a la API key
// (ALPHA_ACTA_ISSUER_SECRET). El destinatario (la cooperativa) puede ser
// cualquier dirección: la emisora le crea una bóveda patrocinada y emite ahí
// la credencial W3C del lote. La identidad did:stellar de la emisora se
// registra una vez (`npm run demo:setup`) y se guarda en
// ALPHA_ACTA_ISSUER_IDENTITY, para no crear un DID nuevo en cada arranque.
//
// Se usa la API REST de ACTA directamente: la entrada del SDK incluye hooks de
// React que no pueden cargarse dentro de una ruta de servidor de Next.
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { MissingEnvError, serverEnv } from "./env";

export interface LotCredentialInput {
  lotId: string;
  owner: string;
  cooperative: string;
  passportRoot: string;
  parcels: { id: string; bags: number; risk: string }[];
}

export class ActaIssuerError extends Error {}

function issuerKeypair(): Keypair {
  const secret = process.env.ALPHA_ACTA_ISSUER_SECRET?.trim();
  if (!secret) throw new MissingEnvError("ALPHA_ACTA_ISSUER_SECRET");
  return Keypair.fromSecret(secret);
}

export function actaIssuerConfigured() {
  return Boolean(process.env.ALPHA_ACTA_ISSUER_SECRET?.trim() && process.env.ALPHA_ACTA_ISSUER_IDENTITY?.trim());
}

function issuerDid(controller: string): string {
  const raw = process.env.ALPHA_ACTA_ISSUER_IDENTITY?.trim().replace(/^'|'$/g, "");
  if (!raw) throw new ActaIssuerError("La identidad ACTA de la emisora no está registrada. Ejecuta npm run demo:setup.");
  const identity = JSON.parse(raw) as { did?: string; controller?: string };
  if (identity.controller !== controller || !identity.did) {
    throw new ActaIssuerError("ALPHA_ACTA_ISSUER_IDENTITY no corresponde a ALPHA_ACTA_ISSUER_SECRET. Repite npm run demo:setup.");
  }
  return identity.did;
}

async function acta<T>(path: string, body?: unknown): Promise<T> {
  const { url, key } = serverEnv.acta();
  const res = await fetch(`${url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-ACTA-Key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw new ActaIssuerError(`ACTA: ${json.message ?? json.error ?? `HTTP ${res.status}`}`);
  return json;
}

type Prepared = { xdr: string; network?: string };

export async function issueLotCredential(input: LotCredentialInput) {
  const kp = issuerKeypair();
  const issuer = kp.publicKey();
  const did = issuerDid(issuer);
  const sign = ({ xdr, network }: Prepared) => {
    if (network && network !== Networks.TESTNET) throw new ActaIssuerError("ACTA devolvió una transacción fuera de Testnet.");
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    tx.sign(kp);
    return tx.toXDR();
  };
  const { actaContractId: contractId } = await acta<{ actaContractId: string }>("/config");
  const vcId = `alpha-pass-${input.lotId}`;

  // Bóveda de la cooperativa, patrocinada por la emisora. Si ya existe, se reutiliza.
  try {
    const vault = await acta<Prepared>("/contracts/sponsored-vault/create", {
      sponsor: issuer, owner: input.owner, didUri: `did:pkh:stellar:testnet:${input.owner}`, sourcePublicKey: issuer, contractId,
    });
    await acta("/contracts/sponsored-vault/create", { signedXdr: sign(vault) });
  } catch (error) {
    if (!(error instanceof Error) || !/exist|already/i.test(error.message)) throw error;
  }

  const prepared = await acta<Prepared>("/contracts/vc/issue", {
    owner: input.owner, vcId, issuer, issuerDid: did, sourcePublicKey: issuer, contractId,
    vcData: JSON.stringify({
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://www.w3.org/ns/credentials/examples/v2"],
      type: ["VerifiableCredential", "AlphaPassLotPassport"],
      credentialSubject: {
        id: `urn:alpha-pass:lot:${input.lotId}`,
        cooperative: input.cooperative,
        cooperativeAddress: input.owner,
        passportRoot: input.passportRoot,
        parcels: input.parcels,
        deforestationCheck: "Whisp (FAO)",
      },
    }),
  });
  const submitted = await acta<{ tx_id?: string }>("/contracts/vc/issue", { signedXdr: sign(prepared) });
  const verified = await acta<{ status?: string }>("/contracts/vault/verify-vc", { owner: input.owner, vcId, contractId });
  return { vcId, txId: submitted.tx_id ?? "", issuer, issuerDid: did, status: verified.status ?? "desconocido" };
}
