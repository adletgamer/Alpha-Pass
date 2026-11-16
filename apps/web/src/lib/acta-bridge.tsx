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
  issuePassport(input: PassportCredentialInput): Promise<{ txId: string; issuerDid: string; vcId: string }>;
  verifyPassport(owner: string, vcId: string): Promise<unknown>;
};

let bridge: Bridge | null = null;

export function getActaBridge(): Bridge {
  if (!bridge) throw new Error("ACTA no está listo todavía. Recarga la página.");
  return bridge;
}

const signer = (xdr: string, opts: { networkPassphrase: string }) => signXdr(xdr, opts);

function Register() {
  const client = useActaClient();
  const { createVault } = useVault();
  const { issue } = useCredential();
  const { verifyVc } = useVaultRead();

  useEffect(() => {
    bridge = {
      async issuePassport(input) {
        const owner = await currentAddress();
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
        });
        return { txId, issuerDid: identity.did, vcId };
      },
      verifyPassport: (owner, vcId) => verifyVc({ owner, vcId }),
    };
    return () => {
      bridge = null;
    };
  }, [client, createVault, issue, verifyVc]);

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
