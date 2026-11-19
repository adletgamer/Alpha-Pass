"use client";

// Conexión y firma con Stellar Wallets Kit (Freighter, xBull, Albedo, Lobstr…).
// Se carga solo en el navegador.

const PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
let kitPromise: Promise<Kit> | null = null;

async function kit(): Promise<Kit> {
  if (!kitPromise) {
    kitPromise = (async () => {
      const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit/sdk");
      const { defaultModules } = await import("@creit.tech/stellar-wallets-kit/modules/utils");
      const { Networks } = await import("@creit.tech/stellar-wallets-kit/types");
      StellarWalletsKit.init({ modules: defaultModules() });
      StellarWalletsKit.setNetwork(
        process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
      );
      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}

export async function connectWallet(): Promise<string> {
  const k = await kit();
  const { address } = await k.authModal();
  return address;
}

export async function currentAddress(): Promise<string> {
  const k = await kit();
  const { address } = await k.getAddress();
  if (!address) throw new Error("Conecta tu wallet primero.");
  return address;
}

/** Firma un XDR con la wallet conectada. Compatible con la firma que piden ACTA y Trustless Work. */
export async function signXdr(unsignedXdr: string, opts?: { networkPassphrase?: string; expectedAddress?: string }): Promise<string> {
  const k = await kit();
  const address = await currentAddress();
  if (opts?.expectedAddress && opts.expectedAddress !== address) {
    throw new Error("Cambiaste de cuenta. Conecta la cuenta seleccionada antes de firmar.");
  }
  const { signedTxXdr } = await k.signTransaction(unsignedXdr, {
    networkPassphrase: opts?.networkPassphrase ?? PASSPHRASE,
    address,
  });
  return signedTxXdr;
}

export const NETWORK_PASSPHRASE = PASSPHRASE;
