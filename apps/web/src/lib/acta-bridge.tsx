"use client";

// Integración con ACTA (credenciales verificables W3C sobre Stellar) usando su SDK oficial.
// El SDK apunta a /api/acta; el servidor agrega la clave X-ACTA-Key. La wallet del
// usuario firma; ninguna clave privada pasa por Alpha Pass.

import { useEffect } from "react";
import { ActaConfig, useActaClient, useCredential, useVault, useVaultRead } from "@acta-team/credentials";
import { currentAddress, signXdr } from "./wallet";

export interface PassportCredentialInput {
  lotId: string;
  cooperative: string;
  passportRoot: string;
  parcels: { id: string; bags: number; risk: string }[];
  verifiedWith: string;
}

type Bridge = {
  issuePassport(input: PassportCredentialInput, expectedOwner?: string): Promise<{ txId: string; issuerDid: string; vcId: string }>;
  verifyPassport(owner: string, vcId: string): Promise<unknown>;
  recoverPassport(owner: string, lotId: string, root: string): Promise<string | null>;
};

let bridge: Bridge | null = null;
const issuerAddress = process.env.NEXT_PUBLIC_ACTA_ISSUER_ADDRESS?.trim();

export function getActaBridge(): Bridge {
  if (!bridge) throw new Error("ACTA no está listo todavía. Recarga la página.");
  return bridge;
}

function Register() {
  const client = useActaClient();
  const { createVault } = useVault();
  const { issue } = useCredential();
  const { verifyVc, getVc } = useVaultRead();

  useEffect(() => {
    bridge = {
      async issuePassport(input, expectedOwner) {
        const owner = await currentAddress();
        if (expectedOwner && owner !== expectedOwner) throw new Error("Conecta la cuenta de la cooperativa que abrió el lote.");
        if (issuerAddress && owner !== issuerAddress) {
          throw new Error("Para emitir el pasaporte, conecta la wallet vinculada a ACTA para este entorno de prueba.");
        }
        const signer = (xdr: string, opts: { networkPassphrase: string }) => signXdr(xdr, { ...opts, expectedAddress: owner });
        const identity = await client.getOrCreateIssuerIdentity({ controller: owner, signTransaction: signer });
        try {
          await createVault({ owner, ownerDid: identity.did, signTransaction: signer });
        } catch (err) {
          // Si la bóveda ya existe, seguimos; cualquier otro error se informa.
          const msg = err instanceof Error ? err.message.toLowerCase() : "";
          if (!msg.includes("exist")) throw err;
        }
        const vcId = `alpha-pass-${input.lotId}`;
        const { txId } = await issue({
          owner,
          vcId,
          issuer: owner,
          issuerDid: identity.did,
          signTransaction: signer,
          vcData: {
            type: ["VerifiableCredential", "AlphaPassLotPassport"],
            credentialSubject: {
              id: `urn:alpha-pass:lot:${input.lotId}`,
              cooperative: input.cooperative,
              passportRoot: input.passportRoot,
              parcels: input.parcels,
              deforestationCheck: input.verifiedWith,
            },
          },
        }).catch((error: unknown) => {
          if (error instanceof Error && /issuer must be the wallet address associated with your API key/i.test(error.message)) {
            throw new Error("ACTA rechazó esta wallet. Conecta la cuenta con la que se creó la clave ACTA de este entorno de prueba.");
          }
          throw error;
        });
        return { txId, issuerDid: identity.did, vcId };
      },
      verifyPassport: (owner, vcId) => verifyVc({ owner, vcId }),
      async recoverPassport(owner, lotId, root) {
        const vcId = `alpha-pass-${lotId}`;
        if ((await verifyVc({ owner, vcId })).status !== "valid") return null;
        const value = await getVc({ owner, vcId });
        const credential = (typeof value === "string" ? JSON.parse(value) : value) as
          { credentialSubject?: { id?: string; passportRoot?: string } } | null;
        return credential?.credentialSubject?.id === `urn:alpha-pass:lot:${lotId}` &&
          credential.credentialSubject.passportRoot === root ? vcId : null;
      },
    };
    return () => {
      bridge = null;
    };
  }, [client, createVault, issue, verifyVc, getVc]);

  return null;
}

export function ActaProvider({ children }: { children: React.ReactNode }) {
  // apiKey "proxy": el SDK exige un valor; el proxy del servidor lo reemplaza por la clave real.
  return (
    <ActaConfig baseURL="/api/acta" apiKey="proxy">
      <Register />
      {children}
    </ActaConfig>
  );
}
